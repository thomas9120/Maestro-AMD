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
          env: { SERVER_PORT: port },
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
