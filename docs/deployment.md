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

Before deployment, add a Groq API key as a Worker secret

```sh
wrangler secret put MODEL_API_KEY --config site/api/wrangler.toml
```

The client is fixed to Groq's OpenAI-compatible HTTPS API. Model identifiers in
[`site/api/src/service/koala/mcp/route.rs`](../site/api/src/service/koala/mcp/route.rs)
route quick, general, difficult, image, audio and guard work. Retrieval stays
inside the Worker, so the provider receives no embedding or reranking request
No paid fallback or automatic overage path is configured

The Cloudflare account provides only the existing rate limiter and edge
runtime; model inference does not use Workers AI. Privacy-safe structured
metrics use Workers Logs with invocation logs disabled and query strings
redacted. No model credential is stored in the repository. `workers_dev` is
disabled and routes are limited to the study endpoint, course paper catalogues,
the FreeBSD manual proxy and the three documented probe paths

Groq's free tier has quotas and no availability SLA. A quota, network or model
failure returns the typed `model_unavailable` response, and the browser keeps
the student in the local note-grounded path. Review Groq Data Controls before
production use because provider reliability and abuse logs can outlive the
request even when model inputs and outputs are not retained by default

Deployment does not grant the Worker access to Minis. Private scope returns
`403` until the separate Minis service supplies a cryptographically verifiable
identity contract; browser roles or headers are never trusted as authority

## Failure diagnosis

| Failure                            | First check                                       |
| ---------------------------------- | ------------------------------------------------- |
| TypeScript compilation             | `npm run check:web`                               |
| Python or browser tests            | `uv run test`                                     |
| Formatting or Markdown             | `uv run lint`                                     |
| Missing page or asset              | strict MkDocs build and `site/web/hooks/site.py`  |
| Page renders but interaction fails | browser console and `site/web/tests/`             |
| Koala falls back to local answers  | Worker route, Groq secret, free quota, rate limit |
| Worker build fails                 | Rust checks from the Study Worker section         |

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

## Reliability contract

The site has two independently deployable failure domains

| Surface | Initial objective | Error budget over 28 days | Evidence source |
| --- | --- | --- | --- |
| Static notes | 99.9% successful edge responses | 40m 19s | GitHub Pages availability plus an external probe |
| Study Worker | 99.0% non-5xx responses to valid requests | 6h 43m | Cloudflare request logs and Worker metrics |

These are operating targets, not measured achievements, until an external monitor and dashboard evaluate them over a complete window

Pause risky releases when either service exhausts its 28-day budget or burns faster than 14.4× for one hour, then restore the last known-good deployment and diagnose before resuming

### Probes

- `/healthz` and `/livez` prove the Worker isolate can execute and return a bounded response
- `/readyz` proves the model secret and rate-limit binding are configured before traffic is accepted
- Readiness deliberately does not spend a model request or make Groq availability part of Worker admission; provider failure returns a typed `503` and the browser keeps its local grounded fallback
- GitHub Pages has no application process, database or queue, so its honest health check is an external HTTPS request to a representative generated page

### Golden signals and tracing

- Latency comes from `latency_ms` and the `Server-Timing` response header
- Traffic is the count of `http_request` events by path and method
- Errors are request status plus bounded outcome codes, with prompts and attachments excluded from logs
- Saturation uses Cloudflare CPU and wall-time telemetry plus `rate_limited` and `limiter_unavailable` outcomes
- `CF-Ray` becomes the bounded `request_id` field and `X-Request-ID` response header for edge-to-Worker correlation
- Groq does not expose a compatible trace contract here, so cross-provider distributed spans remain unavailable rather than being simulated

### Resilience choices

- The Worker rejects excess demand with `429` and `Retry-After` instead of queueing unbounded work
- The browser cancels obsolete or 30-second study requests and falls back locally on model, quota or network failure
- Model calls are not retried automatically because duplicate inference increases cost and recovery load; a person can retry after the typed failure
- Cloudflare owns isolate draining and shutdown; the Worker has no long-lived connection or local write queue requiring application shutdown hooks
- There is no distributed authoritative datastore, so CAP does not govern note reads; edge caches may be eventually consistent while Git and Google Drive remain the sources of truth

### Security and maintenance controls

- Cloudflare terminates HTTPS for the Worker and the API sends HSTS, deny-by-default CSP, no-sniff, frame denial, referrer and permissions headers
- GitHub Pages HTTPS and custom-domain enforcement are provider settings and must be verified after each domain change
- Dependabot covers npm, Cargo, uv and GitHub Actions weekly while locked installs and dependency review protect CI
- The repository and Pages artifact are recoverable copies on one provider, not an off-site backup; a second storage account, credentials, retention policy and restore drill are still required before claiming off-site backup coverage
- `robots.txt`, `sitemap.xml`, canonical metadata, structured data and `llms.txt` are generated during the strict build for search and AI discovery
- Core Web Vitals remain a measured browser outcome; minification and bounded client code are in place, but no performance claim is valid until production field or repeatable lab data is recorded
