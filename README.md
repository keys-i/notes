# UQ Notes

[![Checks](https://github.com/keys-i/notes/actions/workflows/checks.yml/badge.svg)](https://github.com/keys-i/notes/actions/workflows/checks.yml)
[![Website](https://github.com/keys-i/notes/actions/workflows/deploy.yml/badge.svg)](https://github.com/keys-i/notes/actions/workflows/deploy.yml)

Personal UQ course notes, published as a
[MkDocs site](https://uni.keysi.dev)

> [!NOTE]
> These are personal study notes, not official course materials

## Courses

| Course                         | Subject                                     |
| ------------------------------ | ------------------------------------------- |
| [COMP4403](content/COMP/4403/) | Compilers and Interpreters                  |
| [COMP4702](content/COMP/4702/) | Machine Learning                            |
| [MECH2700](content/MECH/2700/) | Computational Engineering and Data Analysis |

## Local Use

Requires Python 3.13+, [uv](https://docs.astral.sh/uv/), Node.js 24 and npm

```sh
uv sync --locked
npm ci
uv run serve
```

Useful checks:

```sh
uv run fmt
uv run lint
uv run test
uv run mkdocs build --strict --config-file site/mkdocs.yml
```

Read the [architecture](docs/architecture.md),
[development](docs/development.md) and [deployment](docs/deployment.md) guides
for maintainer workflows. Contribution policy lives in
[`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md)

## License

Licensed under the [GNU GPL v2](LICENSE)
