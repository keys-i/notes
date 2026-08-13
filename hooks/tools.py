"""Project command entry points."""

from pathlib import Path
from subprocess import call
from sys import executable

WEB_FILES = "**/*.{html,js,md,css}"

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
fmt = lambda: (
    call(["npx", "--yes", "prettier@3.9.6", "--write", WEB_FILES])
    or call(["ruff", "format", "."])
)
lint = lambda: (
    call(["npx", "--yes", "prettier@3.9.6", "--check", WEB_FILES])
    or call(
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
    or call(["ruff", "format", "--check", "."])
    or call(["ruff", "check", "."])
)


def test():
    for path in sorted(Path("tests").glob("*.test.py")):
        if result := call(
            [
                executable,
                "-c",
                f"from runpy import run_path; run_path({str(path)!r}, run_name='__main__')",
            ]
        ):
            return result
    return call(
        [
            "node",
            "--test",
            *(str(path) for path in sorted(Path("tests").glob("*.test.js"))),
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
