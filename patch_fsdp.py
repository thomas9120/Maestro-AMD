"""Idempotent local patch for a known upstream Maestro bug.

models/wan/distributed/fsdp.py imports torch.distributed.fsdp
unconditionally at module load time, even though shard_model() is never
called anywhere on Maestro's single-GPU inference path (see CLAUDE.md,
"Known runtime issues" #1). On any PyTorch build without a working
torch.distributed backend -- e.g. the AMD ROCm nightly wheel for Windows,
which ships without RCCL/GLOO -- that import crashes the whole app before
it can start.

This is applied here (rather than upstream) because a real fix needs a
maintainer to merge it; this keeps AMD installs working in the meantime.
Deliberately does NOT touch torch.distributed at runtime to work around
this (e.g. via a sitecustomize.py / sys.modules stub) -- that was tried
and can trigger an unrelated, non-deterministic process-spawn storm in
AMD's ROCm/TheRock Windows toolchain (see CLAUDE.md "Known runtime
issues" #2). A source-level guard is the only approach verified safe.

Self-detecting and idempotent: does nothing if the file has already been
patched, and does nothing (just logs a warning) if upstream's file no
longer matches what this patch expects -- so an upstream change (including
upstream fixing this properly) can never corrupt the file, it just makes
this patch a silent no-op.
"""
from pathlib import Path

TARGET = Path(__file__).parent / "Maestro" / "app" / "models" / "wan" / "distributed" / "fsdp.py"

MARKER = "# LOCAL PATCH (Maestro AMD)"

ORIGINAL_IMPORTS = (
    "from torch.distributed.fsdp import FullyShardedDataParallel as FSDP\n"
    "from torch.distributed.fsdp import MixedPrecision, ShardingStrategy\n"
    "from torch.distributed.fsdp.wrap import lambda_auto_wrap_policy\n"
)

PATCHED_IMPORTS = (
    f"{MARKER} -- see CLAUDE.md, \"Known runtime issues\" #1.\n"
    "# torch.distributed has no working backend on some PyTorch builds (e.g.\n"
    "# ROCm-on-Windows, which ships without RCCL/GLOO). shard_model() is never\n"
    "# called on the single-GPU inference path, so degrade gracefully instead\n"
    "# of crashing the whole app at import time.\n"
    "try:\n"
    "    from torch.distributed.fsdp import FullyShardedDataParallel as FSDP\n"
    "    from torch.distributed.fsdp import MixedPrecision, ShardingStrategy\n"
    "    from torch.distributed.fsdp.wrap import lambda_auto_wrap_policy\n"
    "except Exception:\n"
    "    FSDP = MixedPrecision = ShardingStrategy = lambda_auto_wrap_policy = None\n"
)

ORIGINAL_SIGNATURE_LINE = "    sharding_strategy=ShardingStrategy.FULL_SHARD,\n"
PATCHED_SIGNATURE_LINE = "    sharding_strategy=None,\n"

# sharding_strategy's default must resolve at call time, not def time --
# ShardingStrategy.FULL_SHARD as an eager default would itself crash at
# import if ShardingStrategy is None.
SIGNATURE_END = "    sync_module_states=True,\n):\n"
GUARD_BODY = (
    "    if FSDP is None:\n"
    "        raise RuntimeError(\n"
    "            \"FSDP sharding is unavailable: this PyTorch build has no \"\n"
    "            \"working torch.distributed backend.\"\n"
    "        )\n"
    "    if sharding_strategy is None:\n"
    "        sharding_strategy = ShardingStrategy.FULL_SHARD\n"
)


def main():
    if not TARGET.exists():
        print(f"[patch_fsdp] {TARGET} not found, skipping (has install.js run yet?)")
        return

    text = TARGET.read_text(encoding="utf-8")

    if MARKER in text:
        print("[patch_fsdp] already patched, nothing to do")
        return

    if ORIGINAL_IMPORTS not in text or ORIGINAL_SIGNATURE_LINE not in text or SIGNATURE_END not in text:
        print(
            "[patch_fsdp] upstream file no longer matches the expected "
            "unpatched content -- skipping (upstream may have already fixed "
            "this, or changed the file in an incompatible way). Check "
            "CLAUDE.md 'Known runtime issues' #1 and verify manually."
        )
        return

    text = text.replace(ORIGINAL_IMPORTS, PATCHED_IMPORTS, 1)
    text = text.replace(ORIGINAL_SIGNATURE_LINE, PATCHED_SIGNATURE_LINE, 1)
    text = text.replace(SIGNATURE_END, SIGNATURE_END + GUARD_BODY, 1)

    TARGET.write_text(text, encoding="utf-8")
    print(f"[patch_fsdp] patched {TARGET}")


if __name__ == "__main__":
    main()
