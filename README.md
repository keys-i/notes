# UQ Notes

Personal course notes, experiments and tiny study tools

<!-- markdownlint-disable MD033 -->
<p align="center">
  <a href="https://github.com/keys-i/notes/actions/workflows/checks.yml">
    <img
      alt="Checks workflow status"
      src="https://github.com/keys-i/notes/actions/workflows/checks.yml/badge.svg"
    >
  </a>
  <a href="https://github.com/keys-i/notes/actions/workflows/deploy.yml">
    <img
      alt="Website deployment status"
      src="https://github.com/keys-i/notes/actions/workflows/deploy.yml/badge.svg"
    >
  </a>
</p>
<!-- markdownlint-enable MD033 -->

![A cheerful koala studies among books, graphs, code and gears](assets/images/readme.webp)

**[Explore the notes →](https://uni.keysi.dev)**

> [!NOTE]
> These are personal study notes, not official course materials

## 🗺️ Pick a course

|     | Course                         | Subject                                     |
| --- | ------------------------------ | ------------------------------------------- |
| 🧩  | [COMP4403](content/COMP/4403/) | Compilers and Interpreters                  |
| 🤖  | [COMP4702](content/COMP/4702/) | Machine Learning                            |
| 🗃️  | [INFS2200](content/INFS/2200/) | Relational Database Systems                 |
| ⚙️  | [MECH2700](content/MECH/2700/) | Computational Engineering and Data Analysis |

## 🧪 Run it locally

Requires Python 3.13+, [uv](https://docs.astral.sh/uv/), Node.js 24 and npm

```sh
uv sync --locked
npm ci
uv run serve
```

[Run every check](docs/development.md#checks)

## 🧭 Go deeper

[Architecture](docs/architecture.md) —
[Development](docs/development.md) —
[Deployment](docs/deployment.md)

Found something to fix? Read [CONTRIBUTING.md](.github/CONTRIBUTING.md),
[ACCESSIBILITY.md](.github/ACCESSIBILITY.md) or
[SECURITY.md](.github/SECURITY.md)

Licensed under the [MIT License](LICENSE)
