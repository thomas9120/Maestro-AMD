# Maestro AMD — repo guide for Claude Code

## What this is

A **minimal Pinokio wrapper** around upstream
[Blizaine/Maestro](https://github.com/Blizaine/Maestro), specialized for
AMD GPUs. Upstream Maestro is an all-in-one local AI video/image/music
studio built on the WanGP pipeline. The stock upstream is NVIDIA-oriented;
this wrapper adds AMD ROCm support without vendoring or forking upstream
code — install/update just `git clone` / `git pull` upstream fresh.

Do **not** copy upstream Python source into this repo. Do **not** patch
upstream from here. If upstream needs a change, send a PR upstream. The
whole point of the wrapper shape is that upstream stays authoritative.

A **sibling project** (repo TBD) covers NVIDIA. Do not add NVIDIA branches
to this codebase; if a genuinely shared abstraction emerges, propose a
third repo both wrappers depend on.

## Layout

Repo root (after `Install` has been clicked in Pinokio):

```
Maestro-AMD/
├── pinokio.js              ← app metadata + dynamic menu
├── install.js              ← clone + build (AMD-guarded)
├── torch.js                ← ROCm wheel install, per gfx target
├── start.js                ← daemon: python launch.py
├── update.js               ← git pull + refresh deps
├── start_latest.js         ← "Update & Start" one-click
├── reset.js                ← rm -rf Maestro/
├── launcher_profile.js     ← AMD GPU detection + runtime profile
├── CLAUDE.md               ← this file
├── README.md               ← user-facing (short)
└── Maestro/                ← upstream clone (created by install.js)
    ├── app/                ← Python backend (launch.py, wgp.py, ...)
    │   ├── env-amd/        ← Python 3.11 venv with ROCm torch
    │   ├── models/         ← downloaded checkpoints (git-ignored)
    │   ├── loras/          ← user LoRAs (git-ignored)
    │   ├── outputs/        ← generated video/image (git-ignored)
    │   └── wgp_config.json ← user settings (git-ignored)
    └── ui/                 ← React frontend (npm install + build)
```

Everything under `Maestro/app/` that is user data is `.gitignore`'d
upstream, which is why `git pull` on update naturally preserves it.

## AMD GPU support

`launcher_profile.js` is the **single source of truth** for what's
supported. Adding a GPU family means editing two places together:

1. Add a helper (`isAmdFoo`) in `launcher_profile.js`.
2. Add a `when`-gated `shell.run` step in `torch.js` with the correct
   ROCm wheel index for that target.

Currently supported (confirmed August 2026):

| Family              | GFX targets                     | Products                          |
|---------------------|---------------------------------|-----------------------------------|
| RDNA 2 dGPU         | gfx1030, gfx1031, gfx1032, gfx1034 | RX 6000 series                 |
| RDNA 3 dGPU         | gfx1100, gfx1101, gfx1102       | RX 7000/8000 (incl. 7900 XTX)     |
| RDNA 4 dGPU         | gfx1200, gfx1201                | RX 9000 series                    |
| Strix Point APU     | gfx1150                         | Ryzen AI 300 (Radeon 880M/890M)   |
| Strix Halo APU      | gfx1151                         | Ryzen AI Max (8060S)              |
| Krackan Point APU   | gfx1152                         | Ryzen AI Krackan Point            |
| Krackan Halo APU    | gfx1153                         | Ryzen AI Krackan Halo             |

## Library versions

Pinned in `torch.js`. Bump procedure:

- **Linux (stable)** — currently `torch==2.11.0` / `torchvision==0.26.0` /
  `torchaudio==2.11.0` via `https://download.pytorch.org/whl/rocm7.2`. To
  bump: check <https://pytorch.org/get-started/previous-versions/> and
  verify the exact triple exists at
  `https://download.pytorch.org/whl/rocm<new_ver>/`. All three packages
  must match ABI (they release together — never mix versions).
- **Windows (nightly)** — unpinned by design. Pulled from
  `https://rocm.nightlies.amd.com/v2-staging/<target>` at install time.
  If AMD reorganizes their v2-staging tree (new/removed target
  directories), update the `winWheel` calls in `torch.js` and the
  helper regexes in `launcher_profile.js` together. Cross-check against
  <https://rocm.nightlies.amd.com/v2-staging/>.
- **Python** — 3.11. ROCm wheels do not ship cp310 builds. Do not
  downgrade.

Skipped intentionally (all CUDA-only, no ROCm equivalent): SageAttention,
FlashAttention, triton-windows, nunchaku, lightx2v, xformers. WanGP's
built-in PyTorch SDPA path handles attention on AMD.

## How updates work

`update.js` runs, in order:

1. `git -C Maestro fetch origin && git -C Maestro reset --hard origin/HEAD`
   — matches upstream tracked files exactly. **Wipes any manual edits**
   inside `Maestro/`. Untracked user data (models, outputs, config) is
   preserved because `git reset` only touches tracked files.
2. Re-runs `uv pip install -r requirements.txt` in the venv.
3. Runs `torch.js` **only if** the runtime marker
   (`Maestro/app/env-amd/.maestro_amd_v1.installed`) is missing. Delete
   that marker to force a full ROCm wheel reinstall on the next update.
4. Self-heals the `seedvc` component if the user deleted it.
5. Rebuilds the React UI (`npm install && npm run build`).

For **easy/automatic updating** the wrapper exposes two shapes in the
Pinokio menu:

- **Update** — just runs `update.js`.
- **Update & Start** — runs `start_latest.js`, which chains `update.js`
  → `start.js`. One click, always latest. This is the recommended
  everyday launcher.

## Development / testing changes

Pinokio scripts cannot be exercised from a shell — you have to drive
Pinokio itself. To try a change:

1. Save the file (Pinokio hot-reloads scripts).
2. Point Pinokio at this folder if it isn't already.
3. Click **Install** (fresh) or the specific action you changed.
4. Watch the terminal panel for command output; watch the browser
   devtools console for menu/UI issues.

Syntax-check locally before iterating in Pinokio:

```
node --check pinokio.js
node --check install.js
node --check torch.js
node --check start.js
node --check update.js
node --check start_latest.js
node --check reset.js
node --check launcher_profile.js
```

For the async-export files (install/torch/start/update),
`node --check` catches parse errors but not runtime issues in the
returned config object. Test the runtime path via Pinokio.

## Do not

- Do not vendor upstream Maestro source files into this repo (that was
  the abandoned approach — remnants in `temp/`, safe to delete when
  convenient).
- Do not add NVIDIA / CUDA / Sol / RTX branches. Sibling project.
- Do not use `--depth 1` for the Maestro clone — the extra weight is
  negligible and it keeps `git pull` trivially correct across upstream
  branch rewrites.
- Do not swap `git reset --hard` for `git pull` in `update.js` without
  thinking — `git pull` fails on divergent local edits and leaves the
  user stuck. `reset --hard origin/HEAD` is the resilient shape.
- Do not gate `install.js` on `requires: { bundle: "ai" }` — that
  assumes NVIDIA-oriented deps.
