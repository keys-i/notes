"""Poetry command entry points for repository checks."""

from subprocess import call


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


def fmt() -> int:
    """Format Markdown files with Prettier."""
    return call(["npx", "--yes", "prettier@3.9.6", "--write", "**/*.md"])
