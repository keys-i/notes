"""Project command entry points."""

from os import environ, execvpe
from pathlib import Path
from subprocess import call
from sys import executable

WEB_FILES = "**/*.{html,ts,md,css}"

clean = lambda: call(
    ["git", "clean", "-fdX", "--", ".cache", ".coverage", "assets/js", "public"]
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
    if result := call(["npm", "run", "--silent", "build:web"]):
        return result
    for path in sorted(Path("site/web/tests").glob("*.test.py")):
        if result := call(
            [
                executable,
                "-c",
                f"from runpy import run_path; run_path({str(path)!r}, run_name='__main__')",
            ]
        ):
            return result
    return call(["npm", "run", "--silent", "test:web"])


def serve():
    """Run MkDocs as the foreground process so shutdown cannot orphan it"""
    command = [
        "mkdocs",
        "serve",
        "--config-file",
        "site/mkdocs.yml",
        "--livereload",
        "--open",
        "-w",
        "assets",
        "-w",
        "site/web/browser",
        "-w",
        "site/web/theme",
        "-w",
        "site/web/styles",
        "-w",
        "site/web/hooks",
    ]
    execvpe(command[0], command, {**environ, "NO_MKDOCS_2_WARNING": "1"})
