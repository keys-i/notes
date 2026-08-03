"""Project command entry points."""

from pathlib import Path
from subprocess import call

clean = lambda: call(
    [
        "git",
        "clean",
        "-fdX",
        "--",
        ".git",
        *(path.name for path in Path.cwd().iterdir() if path.name != ".venv"),
    ]
)
fmt = lambda: call(["npx", "--yes", "prettier@3.9.6", "--write", "**/*.md"])
lint = lambda: call(
    [
        "npx",
        "--yes",
        "markdownlint-cli2@0.23.1",
        "--config",
        "pyproject.toml",
        "--configPointer",
        "/tool/markdownlint-cli2",
        "**/*.md",
    ]
)
serve = lambda: call(
    [
        "mkdocs",
        "serve",
        "--livereload",
        "--open",
        "-w",
        "overrides",
        "-w",
        "hooks",
    ]
)
