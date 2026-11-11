"""Publish root assets and preserve legacy course URLs"""

import html
import json
import os
import re
from pathlib import Path

from mkdocs.structure.files import File

ROOT = Path(__file__).parents[2]
ASSETS = ROOT / "assets"
SUBJECTS = ("COMP", "INFS", "MECH")
VERSIONED_ASSETS = (
    "assets/styles/site.min.css",
    "assets/styles/graph.min.css",
    "assets/styles/pet.min.css",
    "assets/js/comments.min.js",
    "assets/js/graph.min.js",
    "assets/js/pet.min.js",
    "assets/js/math.min.js",
)
WEEK_TITLE = re.compile(r"^(?:W|Week\s+)(\d+)\b", re.IGNORECASE)
PAPERS = json.loads((ROOT / "site/papers.json").read_text(encoding="utf-8"))
ROUTE_LABELS = {"PY": "Past years", "CS": "Cheatsheet"}
CHEATSHEETS = {
    "INFS2200": "INFS2200-cheatsheet.pdf",
    "MECH2700": "MECH2700-cheatsheet.pdf",
}


def paper_display_title(item, code):
    """Turn source filenames into labels without changing their Drive identity"""
    title = re.sub(r"\.(?:pdf|docx?)$", "", item["title"], flags=re.IGNORECASE)
    title = re.sub(r"[_-]+", " ", title)
    title = re.sub(r"(?i)\bexamsol\b", "Exam Solutions", title)
    title = re.sub(r"(?i)\bfinalexam\b", "Final Exam", title)
    title = re.sub(r"(?i)\b(solutions|answers)\d{2}\b", r"\1", title)
    title = re.sub(rf"\b{re.escape(code)}\b", " ", title, flags=re.IGNORECASE)
    years = set(re.findall(r"\b(?:19|20)\d{2}\b", title))
    if years == {str(item["year"])} and "onwards" not in title.lower():
        title = re.sub(rf"\b{item['year']}\b", " ", title)
    if not re.search(r"\b(?:19|20)\d{2}\b", title):
        title = re.sub(r"^\s*\d{3,4}\b", " ", title)
    title = re.sub(r"\b\d{3,4}\s*$", "", title)
    title = re.sub(r"(?i)\bsem\b", "Semester", title)
    title = re.sub(r"\s+", " ", title).strip(" .,-")
    title = re.sub(
        r"(?i)\b(exam|answers|solutions|final|semester|two|examinations|practice|sample|online|onwards)\b",
        lambda match: match.group().capitalize(),
        title,
    )
    if item["kind"] in {"Paper", "Practice"} and not re.search(
        r"(?i)\b(?:answers|solutions)\b", title
    ):
        title = f"{title or 'Exam'} with answers"
    return title or "Exam answers"


def on_config(config):
    """Give deployed assets a commit-specific URL while local serving stays stable"""
    version = re.sub(r"[^0-9A-Za-z_-]", "", os.environ.get("GITHUB_SHA", "dev"))
    config.extra["asset_version"] = (version or "dev")[:40]
    return config


def on_files(files, config):
    """Expose root assets through MkDocs without copying source into content"""
    existing = {file.src_uri for file in files}
    for path in sorted(ASSETS.rglob("*")):
        if path.is_symlink():
            raise ValueError(f"asset symlinks are not allowed: {path}")
        if not path.is_file():
            continue
        source = path.relative_to(ROOT).as_posix()
        if source not in existing:
            files.append(
                File(
                    source,
                    str(ROOT),
                    str(config.site_dir),
                    config.use_directory_urls,
                )
            )
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
        if route in ROUTE_LABELS:
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
    """Expose the curated Drive index only on course paper pages"""
    code = page.meta.get("papers") if page.meta else None
    if code:
        course = PAPERS["courses"][code]
        items = {}
        for item in sorted(
            course["items"], key=lambda value: value["source"] != "primary"
        ):
            if item.get("has_solutions"):
                label = paper_display_title(item, code)
                items.setdefault(
                    (item["year"], label.casefold()), {**item, "display_title": label}
                )
        context["paper_catalog"] = {
            **course,
            "items": list(items.values()),
        }
        context["paper_updated"] = PAPERS["updated"]
    return context


def on_page_markdown(markdown, page, **_):
    """Share generated resource pages while keeping one route file per course"""
    code = page.meta.get("papers") if page.meta else None
    if code:
        return (
            '<nav class="papers__nav" aria-label="Course navigation">'
            f'<a class="papers__back" href="../" aria-label="Back to {code}" '
            f'title="Back to {code}">'
            '<svg aria-hidden="true" viewBox="0 0 24 24">'
            '<path d="m14.5 6-6 6 6 6M9 12h9" />'
            "</svg></a></nav>\n\n"
            "# Past year papers\n\nSolutions and worked answers, grouped by year\n"
        )
    code = page.meta.get("cheatsheet") if page.meta else None
    if not code:
        return markdown
    pdf = CHEATSHEETS[code]
    return (
        '<nav class="papers__nav" aria-label="Course navigation">'
        f'<a class="papers__back" href="../" aria-label="Back to {code}" '
        f'title="Back to {code}">'
        '<svg aria-hidden="true" viewBox="0 0 24 24">'
        '<path d="m14.5 6-6 6 6 6M9 12h9" />'
        "</svg></a></nav>\n\n"
        f"# {code} Cheatsheet\n\n"
        "A one-page exam reference built from the course notes and past papers\n\n"
        f'<section class="cheatsheet" aria-label="{code} cheatsheet reader">'
        '<div class="cheatsheet__bar"><strong>Exam reference</strong>'
        f'<a href="{pdf}" target="_blank" rel="noopener" '
        f'aria-label="Open {code} cheatsheet full screen" title="Full screen">'
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path '
        'd="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg></a></div>'
        '<div class="cheatsheet__viewer">'
        f'<iframe src="{pdf}#view=FitH" title="{code} one-page cheatsheet" '
        'loading="eager"></iframe>'
        f'<a class="cheatsheet__download" href="{pdf}" download '
        f'aria-label="Download {code} cheatsheet" title="Download">'
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path '
        'd="M12 3v12m-5-5 5 5 5-5M5 20h14"/></svg></a>'
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
    leaked_catalog = next(site.rglob("papers.json"), None)
    if leaked_catalog:
        raise RuntimeError(
            f"built site contains the source paper catalogue: "
            f"{leaked_catalog.relative_to(site)}"
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
    for subject in SUBJECTS:
        subject_root = site / subject
        if not subject_root.is_dir():
            continue
        for page in subject_root.rglob("*.html"):
            legacy = site / "markdown" / page.relative_to(site)
            legacy.parent.mkdir(parents=True, exist_ok=True)
            target = os.path.relpath(page, legacy.parent).replace(os.sep, "/")
            legacy.write_text(_redirect(target), encoding="utf-8")
