# UQ Notes

[![Checks](https://github.com/keys-i/notes/actions/workflows/checks.yml/badge.svg)](https://github.com/keys-i/notes/actions/workflows/checks.yml)
[![Website](https://github.com/keys-i/notes/actions/workflows/deploy.yml/badge.svg)](https://github.com/keys-i/notes/actions/workflows/deploy.yml)

Personal UQ course notes, published as a
[MkDocs site](https://keys-i.github.io/notes/).

> [!NOTE]
> These are personal study notes, not official course materials.

## Courses

| Course | Subject |
| --- | --- |
| [COMP4403](notes/markdown/COMP/4403/) | Compilers and Interpreters |
| [COMP4702](notes/markdown/COMP/4702/) | Machine Learning |
| [MECH2700](notes/markdown/MECH/2700/) | Computational Engineering and Data Analysis |

## Local Use

Requires Python 3.13+ and [Poetry](https://python-poetry.org/).

```sh
poetry install
poetry run mkdocs serve
```

Useful checks:

```sh
poetry run lint
poetry run fmt
poetry run mkdocs build --strict
```

## License

Licensed under the [GNU GPL v2](LICENSE).
