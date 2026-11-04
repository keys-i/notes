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
and lint entry points used locally. It also tests, formats, lints and compiles
the Rust study Worker for `wasm32-unknown-unknown`

## Study Worker

The static site works without the Worker and falls back to note-grounded local
answers. Hosted multilingual answers require a separate deployment from
[`api/wrangler.toml`](../api/wrangler.toml)

```sh
cargo fmt --manifest-path api/Cargo.toml --check
cargo test --locked --manifest-path api/Cargo.toml
cargo clippy --locked --manifest-path api/Cargo.toml --all-targets -- -D warnings
cargo check --locked --manifest-path api/Cargo.toml --target wasm32-unknown-unknown
wrangler deploy --config api/wrangler.toml
```

The Cloudflare account must provide the configured Workers AI and rate-limiter
bindings. Privacy-safe structured metrics use Workers Logs with invocation logs
disabled and query strings redacted. No Gemini key or other model secret is
stored in the repository. `workers_dev` is disabled and the route is limited
to `uni.keysi.dev/api/pet`

Deployment does not grant the Worker access to Minis. Private scope returns
`403` until the separate Minis service supplies a cryptographically verifiable
identity contract; browser roles or headers are never trusted as authority

## Failure diagnosis

| Failure                            | First check                                      |
| ---------------------------------- | ------------------------------------------------ |
| TypeScript compilation             | `npm run check:web`                              |
| Python or browser tests            | `uv run test`                                    |
| Formatting or Markdown             | `uv run lint`                                    |
| Missing page or asset              | strict MkDocs build and `site/hooks/site.py`     |
| Page renders but interaction fails | browser console and the relevant `site/ts/` test |
| Koala falls back to local answers  | Worker route, AI binding, rate limit and metrics |
| Worker build fails                 | Rust checks from the Study Worker section        |

Generated output in `public/` and `assets/js/` is disposable. Fix the authored
source, rerun the relevant check, then rebuild rather than patching generated
files

## Rollback

Deployment is a two-way operation because the published site is derived from
Git history. Revert the faulty merge or commit on `main`, push the revert, and
let the same Pages workflow publish the previous source state

Do not rewrite shared history or edit the Pages artifact by hand. If a failing
workflow never deployed, fix it on the branch and rerun the existing workflow

The Worker rolls back independently: deploy `api/` from the last known-good
commit or remove its narrow route while the static helper continues with its
local grounded fallback
