"use strict"

// AMD-only hardware routing. NVIDIA support lives in a sibling project.
// Pinokio exposes both a normalized gpu (`amd`) and a GFX architecture
// target (e.g. `gfx1100`) before Python/PyTorch exists, so this works
// for fresh installs as well as upgrades.

const isAmd = (kernel = {}) => kernel.gpu === "amd"

// RDNA 2 — RX 6000 series (gfx1030, gfx1031, gfx1032, gfx1034)
const isAmdRdna2 = (kernel = {}) =>
  isAmd(kernel) && /^gfx103[0124]$/.test(String(kernel.gpu_target || ""))

// RDNA 3 dGPU — RX 7000 / RX 8000 series (gfx1100, gfx1101, gfx1102).
// Excludes gfx1103 (Phoenix APU) intentionally — that target has its own
// nightly channel and different perf characteristics.
const isAmdRdna3 = (kernel = {}) =>
  isAmd(kernel) && /^gfx110[012]$/.test(String(kernel.gpu_target || ""))

// RDNA 4 — RX 9000 series (gfx1200, gfx1201)
const isAmdRdna4 = (kernel = {}) =>
  isAmd(kernel) && /^gfx120[01]$/.test(String(kernel.gpu_target || ""))

// AMD APUs — Strix Point (gfx1150), Strix Halo (gfx1151),
// Krackan Point (gfx1152), Krackan Halo (gfx1153).
const isAmdApu = (kernel = {}) =>
  isAmd(kernel) && /^gfx115[0-3]$/.test(String(kernel.gpu_target || ""))

// AMD ROCm runtime — single profile covers every supported AMD GPU.
// Windows uses per-gfx-target nightly wheels; Linux uses the stable
// rocm7.2 index. Python 3.11 required (ROCm wheels do not ship cp310
// builds).
const amdRuntimeProfile = () => ({
  env: "env-amd",
  python: "3.11",
  marker: "Maestro/app/env-amd/.maestro_amd_v1.installed",
  label: "AMD ROCm",
})

// Kept as the single call site for other scripts even though there is
// only one profile — mirrors upstream Maestro's shape so future
// per-family branching (e.g. a distinct RDNA 4 profile) plugs in here
// without touching install/torch/start.
const runtimeProfile = () => amdRuntimeProfile()

module.exports = {
  isAmd,
  isAmdRdna2,
  isAmdRdna3,
  isAmdRdna4,
  isAmdApu,
  amdRuntimeProfile,
  runtimeProfile,
}
