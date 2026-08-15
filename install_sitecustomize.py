"""Copy this wrapper's sitecustomize.py into the active venv's
site-packages so CPython auto-loads it at every interpreter startup.

See sitecustomize.py itself for full context on what it works around and
why this shape (as opposed to a source patch, a runtime probe, or an
sys.modules=None sentinel).

Safe to re-run: overwrites in place, no state to keep.
"""
import shutil
import sys
import sysconfig
from pathlib import Path


def main():
    src = Path(__file__).parent / "sitecustomize.py"
    if not src.exists():
        print(f"[install_sitecustomize] source missing: {src}")
        sys.exit(1)

    # sysconfig.get_paths()['purelib'] is the venv's own site-packages
    # (the canonical spot for pure-Python packages) -- more reliable than
    # scanning site.getsitepackages(), which on Windows venvs also lists
    # the venv root and the base interpreter's site-packages.
    dest_dir = Path(sysconfig.get_paths()["purelib"])
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / "sitecustomize.py"
    shutil.copy2(src, dest)
    print(f"[install_sitecustomize] {src} -> {dest}")


if __name__ == "__main__":
    main()
