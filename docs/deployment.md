# Deployment

GitHub Actions builds and publishes the static site through
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)

## Build path

The workflow

1. checks out full Git history for author and creation-date metadata
2. installs the pinned Python and Node toolchains
3. restores dependencies with `npm ci` and the locked `uv` environment
4. runs `uv run --locked mkdocs build --strict --config-file site/mkdocs.yml`
5. uploads `public/` as the GitHub Pages artifact
6. deploys only for a push event, never for a pull request build

Pull requests still execute the build job, which catches missing assets,
invalid plot data, strict MkDocs warnings and template failures before merge

The separate [checks workflow](../.github/workflows/checks.yml) runs the test
and lint entry points used locally

## Failure diagnosis

| Failure                            | First check                                      |
| ---------------------------------- | ------------------------------------------------ |
| TypeScript compilation             | `npm run check:web`                              |
| Python or browser tests            | `uv run test`                                    |
| Formatting or Markdown             | `uv run lint`                                    |
| Missing page or asset              | strict MkDocs build and `site/hooks/site.py`     |
| Page renders but interaction fails | browser console and the relevant `site/ts/` test |

Generated output in `public/` and `assets/js/` is disposable. Fix the authored
source, rerun the relevant check, then rebuild rather than patching generated
files

## Rollback

Deployment is a two-way operation because the published site is derived from
Git history. Revert the faulty merge or commit on `main`, push the revert, and
let the same Pages workflow publish the previous source state

Do not rewrite shared history or edit the Pages artifact by hand. If a failing
workflow never deployed, fix it on the branch and rerun the existing workflow
