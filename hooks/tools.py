"""Project command entry points."""

from pathlib import Path
from subprocess import call


def clean() -> int:
    """Delete files ignored by Git, except the local environment."""
    paths = (
        path.name for path in Path.cwd().iterdir() if path.name != ".venv"
    )
    return call(
        [
            "git",
            "clean",
            "-fdX",
            "--",
            ".git",
            *paths,
        ]
    )

def fmt() -> int:
    """Format Markdown files with Prettier."""
    return call(["npx", "--yes", "prettier@3.9.6", "--write", "**/*.md"])

def lint() -> int:
    """Lint Markdown files with markdownlint-cli2."""
    return call(
        [
            "npx",
            "--yes",
            "markdownlint-cli2@0.23.1",
            "--config",
            "pyproject.toml",
            "--configPointer",
            "/tool/markdownlint-cli2",
            "**/*.md",
        ],
    )

def serve() -> int:
    """Serve the site with live reload."""
    return call(
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
