"""Compile browser TypeScript before MkDocs collects static assets"""

from pathlib import Path
from subprocess import run

ROOT = Path(__file__).parents[3]


def on_pre_build(**_):
    run(["npm", "run", "--silent", "build:web"], cwd=ROOT, check=True)
