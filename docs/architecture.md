# Architecture

## Repository map

```text
.
├── content/              # learner-facing Markdown, grouped by subject and course
├── assets/               # published audio, images, styles, manuals and vendor files
├── site/                 # source and configuration used to build the website
│   ├── hooks/            # Python build rules and project command entry points
│   ├── api/              # Rust edge API for grounded study answers
│   │   └── src/
│   │       ├── input.rs  # request, media and trust-boundary validation
│   │       ├── model.rs  # bounded Groq HTTPS client
│   │       ├── study.rs  # routing, prompts, BM25 and grounding
│   │       └── worker.rs # edge orchestration, cache and responses
│   ├── ts/               # authored browser TypeScript
│   ├── theme/            # Material templates and partials
│   ├── game.toml         # recovery-game data and tuning
│   ├── mkdocs.yml        # MkDocs configuration
│   └── tsconfig*.json    # browser and test type checking
├── tests/                # all Python and TypeScript behaviour tests
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
them. Product source stays in the six named domains above instead of being
split across generic `web`, `config` or `overrides` folders

## Build flow

```text
site/ts/*.ts               # browser source
  → TypeScript compiler    # invoked by site/hooks/typescript.py
  → assets/js/             # generated and ignored

content/                   # note pages
assets/                    # static files
site/theme/                # page templates
  → MkDocs + site/hooks/   # validation, metadata and publication
  → public/                # generated and ignored
```

[`site/hooks/typescript.py`](../site/hooks/typescript.py) compiles browser
scripts before MkDocs collects files

[`site/hooks/site.py`](../site/hooks/site.py) is the publication seam for root
assets. It exposes `assets/` to MkDocs without copying source into `content/`,
so source paths and public `/assets/...` URLs stay aligned

The same hook writes lightweight redirects from the former
`/markdown/<subject>/...` URLs to the current subject paths. This keeps old
bookmarks working while `content/` remains free of compatibility files

Other hooks own one build concern each

- `game.py` validates [`site/game.toml`](../site/game.toml) and makes it
  available to the 404 template
- `graph.py` prepares the note graph and moves its generated data beside the
  browser scripts
- `plot.py` validates bounded JSON from interactive `plot` fences
- `discovery.py` produces discovery files such as `robots.txt` and `llms.txt`
- `man.py` maintains the checked-in FreeBSD manual snapshot used by recovery
  mode

Keep a hook only when it owns build-time behaviour. Browser interaction belongs
in `site/ts/`; note content belongs in `content/`; published files belong in
`assets/`

The optional study helper backend is independent of the static build

```text
current public note sections + short conversation
  → input.rs               # validate size, media signatures and public scope
  → worker.rs              # exact cache, rate limit and typed failures
  → study.rs               # bounded local BM25 and model routing
  → Groq free models       # guard, one answer call and optional transcription
  → deterministic checks   # valid bounded citations or a closed failure
  → browser thread         # rich safe rendering or immediate local fallback
```

The browser supplies the current heading and its neighbours. The Worker ranks
those bounded sections locally with BM25, sends at most 1,800 characters from
each of the top three sections and keeps only the most recent 2,000 conversation
characters. No question or note text is sent to an embedding, HyDE or reranking
service

[`site/api/src/study.rs`](../site/api/src/study.rs) owns the fixed Groq model
routes. Browser input cannot select a model. Text and image requests use one
fail-closed guard call and one answer call; audio adds one transcription call
before the same guarded text path. There is no second verifier model call or
paid-provider fallback. Note answers are accepted only when citations are
present, well formed and resolve to the retrieved evidence

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

## Compatibility boundaries

- Public asset URLs remain under `/assets/`
- Published course paths begin with `COMP/`, `INFS/` or `MECH/`
- Former `/markdown/...` course paths redirect to the current location
- Browser source is TypeScript under `site/ts/`
- Tests live under `tests/`
- Generated `assets/js/` and `public/` files are disposable build output
- The study Worker serves only `/api/pet`; private Minis routes stay separate
