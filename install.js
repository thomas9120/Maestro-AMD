const { runtimeProfile } = require("./launcher_profile")

module.exports = async (kernel) => {
  const runtime = runtimeProfile(kernel)
  return {
    run: [
      {
        when: "{{gpu !== 'amd'}}",
        method: "notify",
        params: {
          html: "Maestro AMD requires an AMD GPU (RDNA 2 or newer, or a Strix Point/Halo/Krackan APU). For NVIDIA, use the upstream Maestro app.",
        },
        next: null,
      },
      {
        when: "{{platform !== 'win32' && platform !== 'linux'}}",
        method: "notify",
        params: {
          html: "AMD ROCm is only supported on Windows and Linux. macOS is not supported.",
        },
        next: null,
      },
      // Wipe any leftover partial clone from an interrupted previous
      // install so the next step's `git clone` cannot fail on a
      // non-empty destination.
      {
        method: "fs.rm",
        params: { path: "Maestro" },
      },
      {
        method: "shell.run",
        params: {
          message: "git clone https://github.com/Blizaine/Maestro Maestro",
        },
      },
      {
        method: "shell.run",
        params: {
          venv: runtime.env,
          venv_python: runtime.python,
          path: "Maestro/app",
          message: [
            "uv pip install -r requirements.txt --index-strategy unsafe-best-match",
            "uv pip install hf-xet pip",
          ],
        },
      },
      {
        method: "script.start",
        params: {
          uri: "torch.js",
          params: {
            venv: runtime.env,
            venv_python: runtime.python,
            path: "Maestro/app",
          },
        },
      },
      // Fetch the seed-vc voice-conversion component (GPL-3.0). Lives
      // in its own repo — pinned to a tag for reproducible installs.
      // Bump the tag here AND in update.js together.
      {
        when: "{{!exists('Maestro/app/postprocessing/seedvc/__init__.py')}}",
        method: "shell.run",
        params: {
          message: "git clone --depth 1 --branch v1.0.0 https://github.com/Blizaine/maestro-seedvc Maestro/app/postprocessing/seedvc",
        },
      },
      // Build the React Web UI. Without this, only the Classic UI
      // (Gradio, at /classic) is reachable.
      {
        when: "{{exists('Maestro/ui/package.json')}}",
        method: "shell.run",
        params: {
          path: "Maestro/ui",
          message: [
            "npm install",
            "npm run build",
          ],
        },
      },
      {
        method: "input",
        params: {
          title: "Installation completed",
          description: 'Click "Start" to get started',
        },
      },
    ],
  }
}
