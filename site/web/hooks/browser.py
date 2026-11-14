"""Compile browser TypeScript before MkDocs collects static assets"""

from pathlib import Path
from subprocess import run

ROOT = Path(__file__).parents[3]
SOURCE = ROOT / "site/web/browser"
OUTPUT = ROOT / "assets/js"
CONFIG = ROOT / "site/tsconfig.json"


def stale():
    """Return whether browser output is missing or older than its inputs"""
    shared = max(
        [CONFIG.stat().st_mtime_ns]
        + [path.stat().st_mtime_ns for path in SOURCE.rglob("*.d.ts")]
    )
    for source in SOURCE.rglob("*.ts"):
        if source.name.endswith(".d.ts"):
            continue
        output = OUTPUT / source.relative_to(SOURCE).with_suffix(".js")
        if not output.is_file() or output.stat().st_mtime_ns < max(
            shared, source.stat().st_mtime_ns
        ):
            return True
    return False


def on_pre_build(**_):
    if stale():
        run(["npm", "run", "--silent", "build:web"], cwd=ROOT, check=True)
