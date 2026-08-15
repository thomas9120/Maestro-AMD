// Full revert to pre-install state: removes the upstream Maestro
// clone, the ROCm venv, and all downloaded models / outputs / config
// stored inside Maestro/. Menu already gates this behind a confirm.
module.exports = {
  run: [
    { method: "fs.rm", params: { path: "Maestro" } },
  ],
}
