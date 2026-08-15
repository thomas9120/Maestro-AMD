const { runtimeProfile } = require("./launcher_profile")

module.exports = async (kernel) => {
  const runtime = runtimeProfile(kernel)
  const port = await kernel.port()
  return {
    daemon: true,
    run: [
      // Guard: if the ROCm runtime marker is missing, tell the user to
      // run Install or Update first instead of failing inside Python.
      {
        when: `{{!exists('${runtime.marker}')}}`,
        method: "input",
        params: {
          title: "AMD ROCm runtime not installed",
          description: "Run Install (or Update) to set up Maestro's AMD ROCm environment, then start Maestro again.",
        },
        next: null,
      },
      {
        method: "shell.run",
        params: {
          venv: runtime.env,
          venv_python: runtime.python,
          // Without this, PyTorch's SDPA silently falls back to the naive
          // "math" attention kernel on this ROCm build (flash/mem-efficient
          // are implemented via AOTriton but gated as experimental) -- the
          // math kernel materializes the full O(n^2) attention matrix,
          // which OOMs on anything but tiny sequence lengths (confirmed:
          // 92GB requested for a 21K-token attention call that flash/
          // mem-efficient handle in under 150MB). See CLAUDE.md "Known
          // runtime issues" #5.
          env: { SERVER_PORT: port, TORCH_ROCM_AOTRITON_ENABLE_EXPERIMENTAL: "1" },
          path: "Maestro/app",
          message: ["python launch.py"],
          on: [
            { event: "/(http:\\/\\/[0-9.:]+)/", done: true },
          ],
        },
      },
      {
        method: "local.set",
        params: { url: "{{input.event[1]}}" },
      },
    ],
  }
}
