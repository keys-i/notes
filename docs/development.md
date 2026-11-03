# Development

## Setup

Install Python 3.13 or later, `uv`, Node.js 24 and npm, then install the locked
dependencies

```sh
uv sync --locked
npm ci
```

Start the local site with live reload

```sh
uv run serve
```

The project command watches `assets/`, `site/ts/`, `site/theme/` and the
MkDocs hooks. Course Markdown is watched by MkDocs through `content/`

## Edit the right source

| Change                         | Source                        |
| ------------------------------ | ----------------------------- |
| Course explanation or example  | `content/<subject>/<course>/` |
| Audio, image or stylesheet     | `assets/`                     |
| Browser behaviour              | `site/ts/`                    |
| Templates and partials         | `site/theme/`                 |
| Game data and timing           | `site/game.toml`              |
| MkDocs and TypeScript settings | `site/`                       |
| Build behaviour                | `site/hooks/`                 |
| Automated proof                | `tests/`                      |

Do not edit `assets/js/` or `public/`. Both are generated and ignored

Keep course explanations in the surrounding note style, use relative links
between Markdown files, and verify equations or exam claims against the source
material before publishing them

## Interactive plots

Use a fenced `plot` block when a learner benefits from panning, zooming or a
rotatable 3D surface. The body is bounded JSON with a title, a useful text
description, one to sixteen Plotly traces, and an optional layout

```plot
{
  "title": "Quadratic function",
  "description": "A parabola with its minimum at the origin",
  "data": [
    {
      "type": "scatter",
      "mode": "lines+markers",
      "x": [-2, -1, 0, 1, 2],
      "y": [4, 1, 0, 1, 4]
    }
  ],
  "layout": {
    "xaxis": {"title": "x"},
    "yaxis": {"title": "y"}
  }
}
```

Supported 2D traces are `bar`, `contour`, `heatmap`, `scatter` and `scattergl`
Supported 3D traces are `mesh3d`, `scatter3d` and `surface`

Always label scientific axes and units, write a description that still
explains the relationship without the graphic, and keep datasets small enough
for a note page. See the 2D and 3D examples in
[`W11.md`](../content/MECH/2700/Lectures/W11.md#explore-the-wave-shape)

## Checks

Run the repository checks before opening a pull request

```sh
uv run fmt
uv run lint
uv run test
uv run mkdocs build --strict --config-file site/mkdocs.yml
```

For focused browser work, these commands avoid a full site build

```sh
npm run check:web
npm run test:web
npm run coverage:web
```

For a visual change, inspect the affected page and the 404 transition at useful
desktop and mobile widths, with reduced motion enabled as a separate check
