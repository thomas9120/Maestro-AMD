// One-click "Update & Start". Runs update.js to fetch the latest
// upstream Maestro, then hands off to start.js (a daemon) which
// terminates this script once the Web UI URL is captured.
module.exports = {
  run: [
    { method: "script.start", params: { uri: "update.js" } },
    { method: "script.start", params: { uri: "start.js" } },
  ],
}
