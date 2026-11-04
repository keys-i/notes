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
[`site/api/wrangler.toml`](../site/api/wrangler.toml)

```sh
cargo fmt --manifest-path site/api/Cargo.toml --check
cargo test --locked --manifest-path site/api/Cargo.toml
cargo clippy --locked --manifest-path site/api/Cargo.toml --all-targets -- -D warnings
cargo check --locked --manifest-path site/api/Cargo.toml --target wasm32-unknown-unknown
wrangler deploy --config site/api/wrangler.toml
```

Before deployment, configure a credentialled HTTPS model gateway whose base
URL ends in `/v1/`

```sh
wrangler secret put MODEL_BASE_URL --config site/api/wrangler.toml
wrangler secret put MODEL_API_KEY --config site/api/wrangler.toml
```

The gateway must expose `/chat/completions`, `/embeddings`,
`/audio/transcriptions` and `/rerank`, and route the model identifiers in
[`site/api/worker.rs`](../site/api/worker.rs) to the corresponding local or
self-hosted open models. A model server running only on a developer laptop is
not reachable from the deployed edge Worker

The Cloudflare account provides only the existing rate limiter and edge
runtime; model inference does not use Workers AI. Privacy-safe structured
metrics use Workers Logs with invocation logs disabled and query strings
redacted. No model credential is stored in the repository. `workers_dev` is
disabled and the route is limited to `uni.keysi.dev/api/pet`

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
| Koala falls back to local answers  | Worker route, model secrets, gateway, rate limit |
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

The Worker rolls back independently: deploy `site/api/` from the last known-good
commit or remove its narrow route while the static helper continues with its
local grounded fallback
