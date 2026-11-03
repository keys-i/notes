"""Generate crawler and LLM discovery files."""

from pathlib import Path

pages = {}

compact = lambda value: " ".join(str(value).split())
on_pre_build = lambda **_: pages.clear()


def on_page_context(context, page, config, **_):
    pages[f"{config.site_url.rstrip('/')}/{page.url}"] = (
        compact(page.title),
        compact(page.meta.get("description") or ""),
    )
    return context


def on_post_build(config):
    site_dir = Path(config.site_dir)
    if not (site_dir / "sitemap.xml").is_file():
        raise RuntimeError("MkDocs did not generate sitemap.xml")

    (site_dir / "robots.txt").write_text(
        "User-agent: *\nAllow: /\n\n"
        f"Sitemap: {config.site_url.rstrip('/')}/sitemap.xml\n",
        encoding="utf-8",
    )

    links = "\n".join(
        f"- [{title.replace('[', r'\[').replace(']', r'\]')}]({url})"
        f"{f': {description}' if description else ''}"
        for url, (title, description) in sorted(pages.items())
    )

    (site_dir / "llms.txt").write_text(
        f"# {config.site_name}\n\n"
        f"> {compact(config.site_description)}\n\n"
        "## Notes\n\n"
        f"{links}\n",
        encoding="utf-8",
    )
