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
├── patch_fsdp.py           ← idempotent source patch, see "Known runtime issues" #1
├── ensure_ffmpeg.py        ← provisions ffmpeg/ffprobe, see #3/#4
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

`patch_fsdp.py` and `ensure_ffmpeg.py` are plain Python — check with
`python -m py_compile patch_fsdp.py ensure_ffmpeg.py` using the same
`env-amd` venv install.js/update.js invoke them with, then actually run
them against a real `Maestro/` clone (both are idempotent and safe to
re-run) before trusting a change to either.

## Known runtime issues & fixes (first bring-up, RX 7900 XTX / Windows, Aug 2026)

Real problems hit getting Maestro AMD running end-to-end on Windows, and
what fixed each one. Kept here so nobody re-derives this from scratch.

### 1. Crash on every Start: `ModuleNotFoundError: torch._C._distributed_c10d`

**Symptom:** `launch.py` crashes at import time, before any UI loads:
```
File "...\models\wan\distributed\fsdp.py", line 5, in <module>
    from torch.distributed.fsdp import FullyShardedDataParallel as FSDP
...
ModuleNotFoundError: No module named 'torch._C._distributed_c10d'
```

**Root cause:** upstream Maestro's `models/wan/distributed/fsdp.py` does an
unconditional top-level `from torch.distributed.fsdp import
FullyShardedDataParallel as FSDP`. `any2video.py` imports `shard_model`
from that file but **never calls it** anywhere on the single-GPU inference
path — dead code. The AMD ROCm-for-Windows nightly wheel ships without
RCCL/GLOO, so `torch.distributed.is_available()` is `False` and that import
chain crashes, taking the whole app down for a code path nothing uses.
Confirmed this isn't ROCm-specific in principle — any PyTorch build without
a working distributed backend would hit it.

**Fix — now automated, `patch_fsdp.py`.** Guards the import and resolves
`sharding_strategy`'s default at call time instead of def time (the default
`ShardingStrategy.FULL_SHARD` would itself crash at import if evaluated
eagerly while `ShardingStrategy` is `None`):

```python
try:
    from torch.distributed.fsdp import FullyShardedDataParallel as FSDP
    from torch.distributed.fsdp import MixedPrecision, ShardingStrategy
    from torch.distributed.fsdp.wrap import lambda_auto_wrap_policy
except Exception:
    FSDP = MixedPrecision = ShardingStrategy = lambda_auto_wrap_policy = None

def shard_model(..., sharding_strategy=None, ...):
    if FSDP is None:
        raise RuntimeError("FSDP sharding is unavailable: ...")
    if sharding_strategy is None:
        sharding_strategy = ShardingStrategy.FULL_SHARD
    ...
```

`patch_fsdp.py` (this wrapper repo, not Maestro's tree — see "Do not
vendor" above) applies this to `Maestro/app/models/wan/distributed/fsdp.py`
after every clone/reset. It's **idempotent and self-detecting**: a marker
comment makes a second run a no-op, and if the target file's content
doesn't exactly match what it expects (upstream changed the file — maybe
even fixed this properly), it skips and logs instead of touching anything.
`install.js` runs it right after the `git clone`; `update.js` runs it right
after `git reset --hard` (which wipes it, same as any local edit to a
tracked file — that's *why* it has to rerun every time, not a one-off).

This was deliberately **not** solved via a runtime monkeypatch (e.g. a
`sitecustomize.py` stubbing `sys.modules['torch.distributed.fsdp']`) even
though that would avoid touching Maestro's file at all — see #2 below for
why that path is unsafe on this specific PyTorch build. A source-level
patch was the only approach verified safe.

Filed upstream too: issue drafted against Blizaine/Maestro with this exact
root cause + fix (not auto-submitted — GitHub issues need the reporter's
own account). **If it's merged when you read this, delete `patch_fsdp.py`
and its call sites in `install.js`/`update.js`** — the guard becomes
redundant (harmless either way, since it self-detects and no-ops, but dead
weight).

### 2. Do NOT try to make `torch.distributed` actually work here

Investigated whether initializing `torch.distributed` properly (instead of
just guarding around the missing import) could work around issue #1.
**It can trigger a runaway subprocess storm** — hundreds of
`offload-arch.exe`/`python.exe` processes spawned in a loop, confirmed
twice with wildly different severity from identical code, including one
case where a watchdog killed the first wave but a second, larger wave
followed from the same still-running root process. This is a race/bug in
AMD's ROCm/TheRock Windows toolchain (`offload-arch` is a Python
console-script invoked via subprocess for HIP arch detection; see
[ROCm/TheRock#3262](https://github.com/ROCm/TheRock/issues/3262) and
[#5003](https://github.com/ROCm/TheRock/issues/5003)), not anything in this
repo. **Never add code that imports/touches `torch.distributed` beyond the
bare guarded probe above.** If you're debugging something in this area,
run with a process-count watchdog first (kill-on-threshold loop for
`offload-arch.exe`) before testing anything live.

### 3. UI warning: "ffmpeg not found in path"

**Root cause:** `imageio-ffmpeg` (a real `requirements.txt` dependency)
bundles its own `ffmpeg.exe` inside its site-packages install, but that's
not on `PATH` under the name `ffmpeg`. Separately, `ffmpeg-python`/`ffmpy`
and Gradio's video-preview code shell out to a literal `ffmpeg`/`ffprobe`
on `PATH` — they don't know about imageio-ffmpeg's private copy.

### 4. Follow-on crash: `ffprobe` not found

**Root cause:** `imageio-ffmpeg` bundles `ffmpeg` only, not `ffprobe`.
Gradio's `video_is_playable()` check needs `ffprobe` specifically (one
plugin's tutorial-video preview failed on this — non-fatal, caught and
logged per-plugin, did not crash the app, but should still be fixed).

**Fix for both — now automated, `ensure_ffmpeg.py`.** Downloads a matched
ffmpeg+ffprobe pair (same binary source the `static-ffmpeg` PyPI package
uses: `github.com/zackees/ffmpeg_bins`, predictable per-platform zip
layout, no versioned-folder-name guessing) and copies both next to the
active venv's own Python executable — which is already on `PATH` whenever
Pinokio's `venv` param is used, i.e. every real Start/Update/Install. Skips
entirely once both binaries already exist (cheap, idempotent, self-healing
if they ever go missing). `install.js` runs it right after the pip-install
step; `update.js` runs it every time too (still a no-op on a cache hit —
the binaries live in the venv, which `Update` never touches, so in
practice this only does real work once per install).

**Important implementation detail — do not use `static-ffmpeg`'s own
Python downloader, and do not use Python's `requests` for fetches in this
repo's helper scripts at all.** `static-ffmpeg` itself downloads via
`requests`, which failed here with
`SSLCertVerificationError: unable to get local issuer certificate` against
a plain `github.com` URL — even though `curl` and `git` on the exact same
machine, same network, succeeded immediately. This is the classic
signature of a Python venv whose `certifi` bundled root-CA list doesn't
include something the OS's own trust store does (e.g. behind a
corporate/AV TLS-inspection proxy) — a real, observed failure mode for
uv-managed Windows Python interpreters, not a one-off. `ensure_ffmpeg.py`
shells out to `curl` for the download and only uses Python's stdlib
`zipfile` (pure local file I/O, no TLS involved) to extract — no
`requests`, no extra pip dependency. If you add another script that needs
to fetch something, follow the same pattern.

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
- Do not use Python's `requests` (or anything relying on `certifi`'s
  bundled CA list) for downloads in this repo's helper scripts — shell out
  to `curl` instead. See "Known runtime issues" #3/#4 for the observed
  failure.
- Do not work around a broken/unavailable Python import by touching
  `torch.distributed` further (e.g. a `sitecustomize.py` stub that probes
  or imports it) — see "Known runtime issues" #2. A source-level guard
  (like `patch_fsdp.py`) is the only verified-safe shape for this class of
  problem.
