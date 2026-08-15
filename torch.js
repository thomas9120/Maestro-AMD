const { runtimeProfile } = require("./launcher_profile")

// AMD ROCm PyTorch install. Flat when-gated list matching wan2gp-amd's
// shape — exactly one step's `when` matches per run.
//
// Windows: per-gfx-target nightly wheels from AMD's v2-staging index.
//   UV_SKIP_WHEEL_FILENAME_CHECK bypasses uv's filename validation
//   (nightly wheels don't match uv's expected pattern).
// Linux: stable rocm7.2 wheels from download.pytorch.org (torch 2.11 as
//   of Aug 2026 — see CLAUDE.md for the bump procedure).
//
// NVIDIA-only extras (SageAttention, FlashAttention, triton-windows,
// nunchaku, lightx2v, xformers) are intentionally skipped. WanGP's
// built-in SDPA path handles attention on AMD.

module.exports = async (kernel) => {
  const runtime = runtimeProfile(kernel)

  const winWheel = (indexUrl) => ({
    method: "shell.run",
    params: {
      env: { UV_SKIP_WHEEL_FILENAME_CHECK: "1" },
      venv: "{{args && args.venv ? args.venv : null}}",
      venv_python: "{{args && args.venv_python ? args.venv_python : null}}",
      path: "{{args && args.path ? args.path : '.'}}",
      message: `uv pip install --pre torch torchvision torchaudio --index-url ${indexUrl} --force-reinstall`,
    },
  })

  return {
    run: [
      {
        method: "log",
        params: { raw: `Installing Maestro's ${runtime.label} acceleration runtime...` },
      },

      // ── Windows AMD, per gfx target ────────────────────────────────
      // RDNA 2 (RX 6000): gfx1030, gfx1031, gfx1032, gfx1034 → dgpu index
      {
        when: "{{platform === 'win32' && gpu === 'amd' && /^gfx103[0124]$/.test(gpu_target)}}",
        ...winWheel("https://rocm.nightlies.amd.com/v2-staging/gfx103X-dgpu"),
      },
      // RDNA 3 (RX 7000/8000, incl. 7900 XTX): gfx1100/1101/1102 → dgpu index
      // Uses the -dgpu variant, faster than -all per ROCm/TheRock#3083.
      {
        when: "{{platform === 'win32' && gpu === 'amd' && /^gfx110[012]$/.test(gpu_target)}}",
        ...winWheel("https://rocm.nightlies.amd.com/v2-staging/gfx110X-dgpu"),
      },
      // RDNA 4 (RX 9000): gfx1200, gfx1201 → -all is the only variant
      {
        when: "{{platform === 'win32' && gpu === 'amd' && /^gfx120[01]$/.test(gpu_target)}}",
        ...winWheel("https://rocm.nightlies.amd.com/v2-staging/gfx120X-all"),
      },
      // APUs get their own dedicated indexes
      {
        when: "{{platform === 'win32' && gpu === 'amd' && /^gfx1150$/.test(gpu_target)}}",
        ...winWheel("https://rocm.nightlies.amd.com/v2-staging/gfx1150"),
      },
      {
        when: "{{platform === 'win32' && gpu === 'amd' && /^gfx1151$/.test(gpu_target)}}",
        ...winWheel("https://rocm.nightlies.amd.com/v2-staging/gfx1151"),
      },
      {
        when: "{{platform === 'win32' && gpu === 'amd' && /^gfx1152$/.test(gpu_target)}}",
        ...winWheel("https://rocm.nightlies.amd.com/v2-staging/gfx1152"),
      },
      {
        when: "{{platform === 'win32' && gpu === 'amd' && /^gfx1153$/.test(gpu_target)}}",
        ...winWheel("https://rocm.nightlies.amd.com/v2-staging/gfx1153"),
      },

      // Windows AMD but an unrecognized gfx target: stop with a clear
      // message instead of silently installing nothing.
      {
        when: "{{platform === 'win32' && gpu === 'amd' && !(/^(gfx103[0124]|gfx110[012]|gfx120[01]|gfx115[0-3])$/.test(gpu_target))}}",
        method: "notify",
        params: {
          html: "Your AMD GPU target is not yet supported on Windows. Supported: RDNA 2 (gfx1030/31/32/34), RDNA 3 dGPU (gfx1100/01/02), RDNA 4 (gfx1200/01), APUs gfx1150/51/52/53. On Linux, any ROCm-supported AMD GPU works via the stable rocm7.2 wheel index.",
        },
        next: null,
      },

      // ── Linux AMD (all supported targets) ──────────────────────────
      {
        when: "{{platform === 'linux' && gpu === 'amd'}}",
        method: "shell.run",
        params: {
          venv: "{{args && args.venv ? args.venv : null}}",
          venv_python: "{{args && args.venv_python ? args.venv_python : null}}",
          path: "{{args && args.path ? args.path : '.'}}",
          message: "uv pip install torch==2.11.0 torchvision==0.26.0 torchaudio==2.11.0 --index-url https://download.pytorch.org/whl/rocm7.2 --force-reinstall",
        },
      },

      // Runtime marker — update.js checks this to skip re-downloading
      // multi-GB ROCm wheels on routine updates. Deleting this file
      // forces a full reinstall on the next Update.
      {
        method: "fs.write",
        params: {
          path: runtime.marker,
          text: `Maestro ${runtime.label} runtime installed. Delete this file and run Update to reinstall it.`,
        },
      },
    ],
  }
}
