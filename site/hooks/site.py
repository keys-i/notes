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
WEEK_TITLE = re.compile(r"^(?:W|Week\s+)(\d+)\b", re.IGNORECASE)


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


def on_nav(nav, **_):
    """Keep numbered weeks natural in navigation and previous/next links"""
    _sort_weeks(nav.items)
    nav.pages = list(_pages(nav.items))
    for index, page in enumerate(nav.pages):
        page.previous_page = nav.pages[index - 1] if index else None
        page.next_page = nav.pages[index + 1] if index + 1 < len(nav.pages) else None
    return nav


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
    for subject in SUBJECTS:
        subject_root = site / subject
        if not subject_root.is_dir():
            continue
        for page in subject_root.rglob("*.html"):
            legacy = site / "markdown" / page.relative_to(site)
            legacy.parent.mkdir(parents=True, exist_ok=True)
            target = os.path.relpath(page, legacy.parent).replace(os.sep, "/")
            legacy.write_text(_redirect(target), encoding="utf-8")
