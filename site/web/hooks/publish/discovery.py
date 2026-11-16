"""Generate crawler and LLM discovery files."""

from pathlib import Path
from xml.etree import ElementTree

pages = {}
SITEMAP_NAMESPACE = "http://www.sitemaps.org/schemas/sitemap/0.9"

compact = lambda value: " ".join(str(value).split())
on_pre_build = lambda **_: pages.clear()


def on_page_context(context, page, config, **_):
    pages[f"{config.site_url.rstrip('/')}/{page.url}"] = (
        compact(page.title),
        compact(page.meta.get("description") or ""),
    )
    return context


def add_api_reference(sitemap, site_url):
    ElementTree.register_namespace("", SITEMAP_NAMESPACE)
    tree = ElementTree.parse(sitemap)
    root = tree.getroot()
    api_url = f"{site_url.rstrip('/')}/api/"
    locations = root.findall(f"{{{SITEMAP_NAMESPACE}}}url/{{{SITEMAP_NAMESPACE}}}loc")
    if all(location.text != api_url for location in locations):
        entry = ElementTree.SubElement(root, f"{{{SITEMAP_NAMESPACE}}}url")
        ElementTree.SubElement(entry, f"{{{SITEMAP_NAMESPACE}}}loc").text = api_url
        tree.write(sitemap, encoding="utf-8", xml_declaration=True)


def on_post_build(config):
    site_dir = Path(config.site_dir)
    sitemap = site_dir / "sitemap.xml"
    if not sitemap.is_file():
        raise RuntimeError("MkDocs did not generate sitemap.xml")
    add_api_reference(sitemap, config.site_url)

    (site_dir / "robots.txt").write_text(
        "User-agent: *\nAllow: /\n\n"
        f"Sitemap: {config.site_url.rstrip('/')}/sitemap.xml\n",
        encoding="utf-8",
    )

    pages[f"{config.site_url.rstrip('/')}/api/"] = (
        "Keysi Notes API",
        "Interactive OpenAPI reference for the study services",
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
