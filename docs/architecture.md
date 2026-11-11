# Architecture

## Repository map

```text
.
├── content/              # learner-facing Markdown, grouped by subject and course
├── assets/               # published media, cheatsheet sources and vendor files
├── site/                 # source and configuration used to build the website
│   ├── api/              # Rust edge API for grounded study answers
│   │   ├── src/
│   │   │   ├── routing/       # Worker entry, responses, health and telemetry
│   │   │   ├── service/
│   │   │   │   ├── koala/     # route entry for study requests
│   │   │   │   │   ├── request/ # input, files, output and response caching
│   │   │   │   │   └── mcp/     # routing, reranking, prompts and LLM work
│   │   │   │   ├── manuals/   # FreeBSD configuration and proxy
│   │   │   │   └── papers/    # paper configuration and catalogue
│   │   │   └── shared/cache/  # cache access, opaque keys and policies
│   ├── config/           # editable game, paper and manual TOML
│   ├── web/              # authored website source
│   │   ├── browser/      # TypeScript grouped by page, study and recovery work
│   │   ├── hooks/        # Python content and publication build rules
│   │   ├── styles/       # authored CSS published under /assets/styles
│   │   ├── tests/        # Python hook and TypeScript browser tests
│   │   └── theme/        # Material templates and partials
│   ├── mkdocs.yml        # MkDocs configuration
│   └── tsconfig*.json    # browser and test type checking
├── docs/                 # architecture, development and deployment guides
├── .github/              # contribution policy, issue templates and CI workflows
├── pyproject.toml        # Python dependencies, commands, lint and coverage settings
├── uv.lock               # exact Python dependency versions
├── package.json          # TypeScript build, test and coverage commands
└── package-lock.json     # exact Node dependency versions
```

```text
# Generated locally and never edited
assets/js/                # compiled browser scripts
public/                   # built website
node_modules/              # installed Node dependencies
site/api/build/            # compiled Worker bundle
site/api/target/           # Rust build cache
```

The root keeps standard tool entry files where `uv`, npm and GitHub expect
them. Product source stays grouped by ownership instead of being split across
generic language folders

## Build flow

```text
site/web/browser/**/*.ts   # browser source grouped by runtime responsibility
  → TypeScript compiler    # invoked by site/web/hooks/browser.py
  → assets/js/{page,study,recovery}/ # generated and ignored

content/                   # note pages
assets/                    # static media and vendor files
site/web/styles/           # authored CSS exposed as /assets/styles
site/web/theme/            # page templates
  → MkDocs + site/web/hooks/ # validation, metadata and publication
  → public/                # generated and ignored
```

[`site/web/hooks/browser.py`](../site/web/hooks/browser.py) compiles browser
scripts before MkDocs collects files

[`site/web/hooks/publish/site.py`](../site/web/hooks/publish/site.py) is the
publication seam for root assets. It exposes `assets/` and authored
`site/web/styles/` files to MkDocs without copying source into `content/`, so
public `/assets/...` URLs remain stable

Course paper pages carry only their course code. The Worker reads
`site/config/papers.toml`, expands validated Google resource codes and returns
one course from `/api/papers/<course>` without publishing a whole-site JSON file

The same hook writes lightweight redirects from the former
`/markdown/<subject>/...` URLs to the current subject paths. This keeps old
bookmarks working while `content/` remains free of compatibility files

Other hooks own one build concern each

- `publish/game.py` validates
  [`site/config/game.toml`](../site/config/game.toml) for the 404 template
- `content/graph.py` prepares graph data and moves it beside the browser script
- `content/plot.py` validates bounded JSON from interactive `plot` fences
- `publish/discovery.py` produces `robots.txt` and `llms.txt`

Some hook and browser files deliberately share a feature name without sharing
an implementation. `content/graph.py` and `content/plot.py` prepare trusted
build artifacts, while `browser/page/graph.ts` and `browser/page/plot.ts`
render them. `publish/game.py` validates configuration, while
`browser/recovery/game.ts` owns game state and interaction. Their parent folders
identify the execution phase and keep each rule in one owner

The recovery shell requests manual pages through `/api/manuals/freebsd`. The
Worker validates the query, fetches the configured FreeBSD renderer and caches
the response at the edge; `site/config/manual.toml` keeps only release and
alias policy rather than duplicating FreeBSD's page index

Keep a hook only when it owns build-time behaviour. Browser interaction belongs
in `site/web/browser/`; note content belongs in `content/`; authored styles
belong in `site/web/styles/`; published media belongs in `assets/`

The optional study helper backend is independent of the static build

```text
current public note sections + short conversation
  → routing/mod.rs         # route and origin controls
  → service/koala/mod.rs   # Koala route, body limit and request decoding
  → koala/request/         # validation, attachments, safe output and cache
  → koala/mcp/mod.rs       # authorise, rate-limit and coordinate the answer
  → koala/mcp/route.rs     # fixed model selection and answer kind
  → koala/mcp/rank.rs      # bounded local BM25 evidence reranking
  → koala/mcp/llm.rs       # bounded OpenAI-compatible provider transport
  → Groq free models       # guard, one answer call and optional transcription
  → deterministic checks   # valid bounded citations or a closed failure
  → browser thread         # rich safe rendering or immediate local fallback
```

The browser supplies the current heading and its neighbours. The Worker ranks
those bounded sections locally with BM25, sends at most 1,800 characters from
each of the top three sections and keeps only the most recent 2,000 conversation
characters. No question or note text is sent to an embedding, HyDE or reranking
service

[`site/api/src/service/koala/mcp/route.rs`](../site/api/src/service/koala/mcp/route.rs)
owns the fixed Groq model routes. Browser input cannot select a model. Text and
image requests use one fail-closed guard call and one answer call; audio adds
one transcription call before the same guarded text path. There is no second
verifier model call or paid-provider fallback. Note answers are accepted only
when citations are present, well formed and resolve to the retrieved evidence

`mcp/` is the internal model coordination pipeline, not a networked Model
Context Protocol server. Its fallback module converts provider failure into the
typed `503` consumed by the browser's local answer path; it does not retry or
silently spend a second model request

Long-lived system and task prompts live as editable `.prompt` sources under
`mcp/prompt/` and are embedded at compile time with no runtime file read. Their
exact contents participate in the response-cache key, so a prompt edit cannot
reuse an older generated answer

This is one modular Cloudflare Worker rather than networked microservices
Cloudflare schedules independent requests concurrently, while each request
keeps dependent safety steps ordered. The guard must succeed before inference,
so adding task fan-out there would weaken the trust boundary without reducing
latency

Exact cache keys include the prompt version, public access scope, locale, note
content and model route. Shared edge caching is disabled for follow-ups and
personal-looking prompts. The browser keeps a small page-session cache so
repeated questions remain fast without durable chat history

## Runtime ownership

Normal note pages use the Material theme plus the shared styles and scripts in
`assets/`. The 404 page additionally loads the recovery game and shell

The koala remains useful without the Worker: its local answer path searches the
rendered note, states when evidence is absent and never inserts returned markup
as HTML. Hosted answers add multilingual conversation and cited retrieval when
`/api/pet` is available

`/api/pet` accepts public note context only. A requested Minis scope fails
closed; the helper links to `/mini/`, whose separate authenticated gateway owns
its sessions, roles and private student data. The pet Worker never receives a
Minis cookie, credential, plan or marks record

Workers Logs receives only outcome, selected model, prompt version, latency
and cache-hit state. Invocation logs are disabled and query strings are
redacted. Questions, note text, answers, IP addresses and user identifiers are
excluded from application telemetry

Interactive note plots load the pinned Plotly browser bundle only on a page
that contains a validated `plot` fence. Generated JavaScript in `assets/js/`
is build output and must never be edited directly

## Work placement

| Work | Owner | Reason |
| --- | --- | --- |
| Note search, graph playback, themes and paper filtering | Static browser code | Immediate interaction with no network dependency or private state |
| Paper catalogue validation, primary-before-fallback deduplication and URL expansion | Worker paper service | One reproducible embedded catalogue per deployment with no Drive credential in the browser |
| Koala inference, input validation, rate limiting, probes and operational telemetry | Cloudflare Worker | Secrets and abuse controls stay server-side while static notes remain available during failure |
| PDF text extraction, OCR and question/subpart indexing | No current owner | Add a queued, cached document worker only after Drive access, retention, copyright and failure policy are authorised |

Moving static search, graph rendering or reader themes into a Worker would add
latency and a new failure domain without reducing client work. A document worker
becomes worthwhile only when extraction can be cached by immutable Drive file
revision, bounded by size and page count, and isolated from the request path by
queue backpressure

## Compatibility boundaries

- Public asset URLs remain under `/assets/`
- Published course paths begin with `COMP/`, `INFS/` or `MECH/`
- Former `/markdown/...` course paths redirect to the current location
- Browser source is TypeScript under `site/web/browser/`
- Web and MkDocs tests live under `site/web/tests/`
- Generated `assets/js/` and `public/` files are disposable build output
- The Worker serves `/api/pet`, `/api/papers/<course>`,
  `/api/manuals/freebsd`, `/healthz`, `/livez` and `/readyz`
- Private Minis routes stay separate
