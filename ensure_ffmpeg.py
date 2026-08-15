"""Ensure ffmpeg/ffprobe are on PATH for the active Python environment.

Maestro's own dependencies don't guarantee this: imageio-ffmpeg (a real
requirements.txt pin) bundles an ffmpeg binary but doesn't expose it under
the plain `ffmpeg` name on PATH, and ships no ffprobe at all. Several other
dependencies (ffmpeg-python, ffmpy -- used by Gradio's video preview) shell
out to literal `ffmpeg`/`ffprobe` commands and know nothing about
imageio-ffmpeg's private copy. See CLAUDE.md "Known runtime issues" #3/#4.

Fetches a matched ffmpeg+ffprobe pair from the same binary source the
`static-ffmpeg` PyPI package uses (github.com/zackees/ffmpeg_bins) via
`curl` rather than Python's `requests`/certifi -- some Windows Python venvs
(observed with uv-managed interpreters here) fail TLS verification through
`requests` even when the system's own trust store (used by `curl`/`git`)
is fine, e.g. behind a corporate/AV TLS-inspection proxy. `curl` is already
relied on elsewhere in this wrapper and has no such issue.

Safe to re-run -- skips entirely once both binaries already exist next to
the active venv's own Python executable (which is already on PATH whenever
the venv is active), and self-healing if they ever go missing.
"""
import os
import platform
import shutil
import stat
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

FFMPEG_BINS_VERSION = "v8.0"
FFMPEG_BINS_BASE_URL = f"https://github.com/zackees/ffmpeg_bins/raw/main/{FFMPEG_BINS_VERSION}"


def _platform_key():
    machine = platform.machine().lower()
    is_arm = machine in ("arm64", "aarch64")
    if sys.platform == "win32":
        return "win32"
    if sys.platform == "darwin":
        return "darwin_arm64" if is_arm else "darwin"
    if sys.platform.startswith("linux"):
        return "linux_arm64" if is_arm else "linux"
    raise RuntimeError(f"Unsupported platform: {sys.platform}")


def main():
    key = _platform_key()
    ext = ".exe" if sys.platform == "win32" else ""

    bin_dir = Path(sys.executable).parent
    ffmpeg_dest = bin_dir / f"ffmpeg{ext}"
    ffprobe_dest = bin_dir / f"ffprobe{ext}"

    if ffmpeg_dest.exists() and ffprobe_dest.exists():
        print(f"[ensure_ffmpeg] already present: {ffmpeg_dest}, {ffprobe_dest}")
        return

    url = f"{FFMPEG_BINS_BASE_URL}/{key}.zip"

    with tempfile.TemporaryDirectory() as tmp_str:
        tmp = Path(tmp_str)
        zip_path = tmp / "ffmpeg_bins.zip"

        print(f"[ensure_ffmpeg] downloading {url}")
        subprocess.run(["curl", "-fL", "-o", str(zip_path), url], check=True)

        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(tmp)

        src_dir = tmp / key
        for name, dest in ((f"ffmpeg{ext}", ffmpeg_dest), (f"ffprobe{ext}", ffprobe_dest)):
            src = src_dir / name
            shutil.copy2(src, dest)
            mode = os.stat(dest).st_mode
            os.chmod(dest, mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
            print(f"[ensure_ffmpeg] {name} -> {dest}")


if __name__ == "__main__":
    main()
