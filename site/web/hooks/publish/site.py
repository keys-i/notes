"""Publish root assets and preserve legacy course URLs"""

import html
import json
import os
import re
from datetime import date
from pathlib import Path

from mkdocs.structure.files import File

from hooks.content import site_courses

ROOT = Path(__file__).parents[4]
ASSETS = ROOT / "assets"
STYLES = ROOT / "site/web/styles"
SUBJECTS = ("COMP", "INFS", "MECH")
VERSIONED_ASSETS = (
    "assets/styles/site.min.css",
    "assets/styles/graph.min.css",
    "assets/styles/pet.min.css",
    "assets/js/page/comments.min.js",
    "assets/js/page/graph.min.js",
    "assets/js/study/koala.min.js",
    "assets/js/page/math.min.js",
    "assets/styles/study/courses.min.css",
    "assets/js/study/courses.min.js",
)
COURSE_ASSET_BUDGETS = {
    "assets/js/study/courses.min.js": 12 * 1024,
    "assets/styles/study/courses.min.css": 10 * 1024,
}
WEEK_TITLE = re.compile(r"^(?:W|Week\s+)(\d+)\b", re.IGNORECASE)
COURSE_ROUTE = re.compile(r"^(COMP|INFS|MECH)/(\d{4})/?$")
ROUTE_LABELS = {"PY": "Past years", "CS": "Cheatsheet"}
CHEATSHEETS = {
    "INFS2200": "INFS2200-cheatsheet.pdf",
    "MECH2700": "MECH2700-cheatsheet.pdf",
}


def on_config(config):
    """Give deployed assets a commit-specific URL while local serving stays stable"""
    version = re.sub(r"[^0-9A-Za-z_-]", "", os.environ.get("GITHUB_SHA", "dev"))
    config.extra["asset_version"] = (version or "dev")[:40]
    return config


def on_files(files, config):
    """Expose authored assets at their stable public paths"""
    existing = {getattr(file, "dest_uri", None) or file.src_uri for file in files}
    for root, prefix in ((ASSETS, "assets"), (STYLES, "assets/styles")):
        for path in sorted(root.rglob("*")):
            if path.is_symlink():
                raise ValueError(f"asset symlinks are not allowed: {path}")
            if not path.is_file():
                continue
            source = path.relative_to(root).as_posix()
            public = f"{prefix}/{source}"
            if public not in existing:
                files.append(
                    File(
                        source,
                        str(root),
                        str(config.site_dir),
                        config.use_directory_urls,
                        dest_uri=public,
                    )
                )
                existing.add(public)
    return files


def _week_number(item):
    match = WEEK_TITLE.match(str(getattr(item, "title", "") or ""))
    return int(match.group(1)) if match else None


def _sort_weeks(items):
    """Naturally order week pages while preserving every non-week slot"""
    weeks = sorted(
        (item for item in items if _week_number(item) is not None),
        key=_week_number,
    )
    ordered = iter(weeks)
    for index, item in enumerate(items):
        if _week_number(item) is not None:
            items[index] = next(ordered)
        children = getattr(items[index], "children", None)
        if children:
            _sort_weeks(children)


def _pages(items):
    for item in items:
        if getattr(item, "is_page", False):
            yield item
        elif getattr(item, "children", None):
            yield from _pages(item.children)


def _label_compact_routes(items):
    for item in items:
        children = getattr(item, "children", None)
        url = getattr(item, "url", "") or ""
        if not url and children:
            url = getattr(children[0], "url", "") or ""
        route = url.rstrip("/").rsplit("/", 1)[-1]
        course = COURSE_ROUTE.fullmatch(url)
        if course and children:
            code = "".join(course.groups())
            title = str(getattr(children[0], "title", "")).removeprefix(f"{code} ")
            if title:
                item.title = f"{course.group(2)}: {title}"
        elif route in ROUTE_LABELS:
            item.title = ROUTE_LABELS[route]
        if children:
            _label_compact_routes(children)


def on_nav(nav, **_):
    """Keep navigation labels, weeks and previous/next links coherent"""
    _sort_weeks(nav.items)
    _label_compact_routes(nav.items)
    nav.pages = list(_pages(nav.items))
    for index, page in enumerate(nav.pages):
        page.previous_page = nav.pages[index - 1] if index else None
        page.next_page = nav.pages[index + 1] if index + 1 < len(nav.pages) else None
    return nav


def on_page_context(context, page, **_):
    """Expose paper and mature course context without publishing source data"""
    code = page.meta.get("papers") if page.meta else None
    if code:
        context["paper_catalog"] = {"course": code}
    if getattr(page, "is_homepage", False):
        loaded = site_courses(
            ROOT / "site/config/courses.toml",
            ROOT / "content",
            date.today(),
        )
        context["course_catalog"] = loaded
    return context


def on_page_markdown(markdown, page, **_):
    """Share generated resource pages while keeping one route file per course"""
    code = page.meta.get("papers") if page.meta else None
    if code:
        body = (
            '<nav class="papers__nav" aria-label="Course navigation">'
            f'<a class="papers__back" href="../" aria-label="Back to {code}" '
            f'title="Back to {code}">'
            f'<span aria-hidden="true">←</span><span>{code}</span></a></nav>\n\n'
            "# Past year papers\n"
        )
        authored = markdown.strip()
        return f"{body}\n{authored}\n" if authored else body
    code = page.meta.get("cheatsheet") if page.meta else None
    if not code:
        return markdown
    pdf = CHEATSHEETS[code]
    return (
        '<nav class="papers__nav" aria-label="Course navigation">'
        f'<a class="papers__back" href="../" aria-label="Back to {code}" '
        f'title="Back to {code}">'
        f'<span aria-hidden="true">←</span><span>{code}</span></a></nav>\n\n'
        f"# {code} Cheatsheet\n\n"
        "A printable formula sheet built from the course notes and past papers\n\n"
        f'<section class="cheatsheet" aria-label="{code} cheatsheet reader">'
        '<header class="cheatsheet__bar"><strong>Reader</strong>'
        '<nav class="cheatsheet__actions" aria-label="Reader controls">'
        f'<a class="cheatsheet__fullscreen" href="{pdf}" target="_blank" rel="noopener" '
        f'aria-label="Open {code} cheatsheet full screen" title="Full screen">'
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path '
        'd="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg></a>'
        f'<a class="cheatsheet__download" href="{pdf}" download '
        f'aria-label="Download {code} cheatsheet" title="Download">'
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path '
        'd="M12 3v12m-5-5 5 5 5-5M5 20h14"/></svg></a>'
        "</nav></header>"
        '<div class="cheatsheet__viewer">'
        f'<iframe src="{pdf}#view=FitH" title="{code} one-page cheatsheet" '
        'loading="eager"></iframe>'
        "</div></section>"
    )


def _redirect(target):
    safe = html.escape(target, quote=True)
    script_target = (
        json.dumps(target)
        .replace("<", r"\u003c")
        .replace(">", r"\u003e")
        .replace("&", r"\u0026")
    )
    return (
        "<!doctype html><meta charset=utf-8>"
        f'<link rel=canonical href="{safe}">'
        f'<meta http-equiv=refresh content="0;url={safe}">'
        f"<script>location.replace(new URL({script_target},location.href).href"
        "+location.search+location.hash)</script>"
        f'<a href="{safe}">This note moved</a>'
    )


def on_post_build(config):
    """Redirect the former markdown subject paths to their stable pages"""
    site = Path(config.site_dir)
    blocked_catalogues = {
        "courses.json": "course catalogue",
        "papers.json": "source paper catalogue",
        "courses.toml": "source course catalogue",
        "papers.toml": "source paper catalogue",
    }
    for candidate in site.rglob("*"):
        if candidate.is_file() and candidate.name in blocked_catalogues:
            raise RuntimeError(
                f"built site contains the {blocked_catalogues[candidate.name]}: "
                f"{candidate.relative_to(site)}"
            )
    index = site / "index.html"
    if index.is_file():
        markup = index.read_text(encoding="utf-8")
        version = config.extra.get("asset_version", "dev")
        missing = [
            asset for asset in VERSIONED_ASSETS if f"{asset}?v={version}" not in markup
        ]
        if missing:
            raise RuntimeError(
                f"built assets lack version {version}: {', '.join(missing)}"
            )
    for asset, budget in COURSE_ASSET_BUDGETS.items():
        path = site / asset
        if not path.is_file():
            raise RuntimeError(f"built course catalogue asset is missing: {asset}")
        if path.stat().st_size > budget:
            raise RuntimeError(
                f"built course catalogue asset exceeds {budget} bytes: {asset}"
            )
    for subject in SUBJECTS:
        subject_root = site / subject
        if not subject_root.is_dir():
            continue
        for page in subject_root.rglob("*.html"):
            legacy = site / "markdown" / page.relative_to(site)
            legacy.parent.mkdir(parents=True, exist_ok=True)
            target = os.path.relpath(page, legacy.parent).replace(os.sep, "/")
            legacy.write_text(_redirect(target), encoding="utf-8")
