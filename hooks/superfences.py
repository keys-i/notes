"""Configure local MkDocs behavior."""

import re
from html.parser import HTMLParser
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urljoin, urlsplit

from mermaid2 import fence_mermaid_custom
from mkdocs.plugins import event_priority

pages = {}


class LinkCollector(HTMLParser):
    """Collect rendered Markdown links."""

    def __init__(self):
        super().__init__()
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.hrefs.extend(
                value for name, value in attrs if name == "href" and value
            )


def page_url(url):
    """Return a URL without query, fragment, or trailing slash."""
    parts = urlsplit(url)
    return parts._replace(query="", fragment="").geturl().rstrip("/")


def on_config(config):
    superfences = config.mdx_configs.setdefault("pymdownx.superfences", {})
    custom_fences = superfences.setdefault("custom_fences", [])

    if not any(fence.get("name") == "mermaid" for fence in custom_fences):
        custom_fences.insert(
            0,
            {
                "name": "mermaid",
                "class": "mermaid",
                "format": fence_mermaid_custom,
            },
        )

    return config


def on_pre_build(**_):
    pages.clear()


@event_priority(-50)
def on_page_markdown(markdown, **_):
    """Make example callouts collapsible by default."""
    return re.sub(
        r"(?m)^([ \t]*)!!! example(?=[ \t]|$)",
        r"\1??? example",
        markdown,
    )


def on_page_context(context, page, config, **_):
    """Collect page metadata for llms.txt."""
    url = urljoin(f"{config.site_url.rstrip('/')}/", page.url)
    title = " ".join(str(page.title).split())
    description = " ".join(str(page.meta.get("description") or "").split())
    pages[url] = (title, description)
    return context


def on_page_content(html, page, config, **_):
    """Add standard Markdown links to the interactive graph."""
    graph = config.plugins["obsidian-interactive-graph"]
    parser = LinkCollector()
    parser.feed(html)

    source = graph.nodes[graph.get_page_path(page)]
    nodes_by_url = {
        page_url(node["url"]): node for node in graph.nodes.values()
    }
    edges = {
        (edge["source"], edge["target"]) for edge in graph.data["links"]
    }

    for href in parser.hrefs:
        target = nodes_by_url.get(
            page_url(
                urljoin(page.abs_url, href)
            )
        )
        if not target or target is source:
            continue

        edge = (str(source["id"]), str(target["id"]))
        if edge in edges:
            continue

        graph.data["links"].append({"source": edge[0], "target": edge[1]})
        source["symbolSize"] += 1
        target["symbolSize"] += 1
        edges.add(edge)

    return html


def on_post_build(config, **_):
    """Write crawler and LLM discovery files."""
    site_dir = Path(config.site_dir)
    base_url = f"{config.site_url.rstrip('/')}/"
    sitemap_url = urljoin(base_url, "sitemap.xml")

    if not (site_dir / "sitemap.xml").is_file():
        raise RuntimeError("MkDocs did not generate sitemap.xml")

    (site_dir / "robots.txt").write_text(
        f"User-agent: *\nAllow: /\n\nSitemap: {sitemap_url}\n",
        encoding="utf-8",
    )

    links = []
    for url, (title, description) in sorted(pages.items()):
        title = title.replace("[", r"\[").replace("]", r"\]")
        suffix = f": {description}" if description else ""
        links.append(f"- [{title}]({url}){suffix}")

    (site_dir / "llms.txt").write_text(
        f"# {config.site_name}\n\n"
        f"> {' '.join(config.site_description.split())}\n\n"
        "## Notes\n\n"
        f"{'\n'.join(links)}\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    from tempfile import TemporaryDirectory

    assert (
        on_page_markdown('!!! example "Summary line"\n\tDetail below.')
        == '??? example "Summary line"\n\tDetail below.'
    )

    nodes = {
        "source": {"id": 0, "url": "/source/", "symbolSize": 0},
        "target": {"id": 1, "url": "/target/", "symbolSize": 0},
    }
    graph = SimpleNamespace(
        nodes=nodes,
        data={"links": []},
        get_page_path=lambda _: "source",
    )
    config = SimpleNamespace(
        plugins={"obsidian-interactive-graph": graph},
    )
    on_page_content(
        '<a href="/target/#notes">Target</a><img src="/ignored/">',
        SimpleNamespace(abs_url="/source/"),
        config,
    )
    assert graph.data["links"] == [{"source": "0", "target": "1"}]

    with TemporaryDirectory() as directory:
        config = SimpleNamespace(
            site_dir=directory,
            site_url="https://example.com/docs",
            site_name="Docs",
            site_description="Useful docs",
        )
        Path(directory, "sitemap.xml").touch()
        on_pre_build()
        on_page_context(
            {},
            SimpleNamespace(
                url="",
                title="Home",
                meta={"description": "Start here"},
            ),
            config,
        )
        on_post_build(config)
        assert Path(directory, "robots.txt").read_text() == (
            "User-agent: *\nAllow: /\n\n"
            "Sitemap: https://example.com/docs/sitemap.xml\n"
        )
        assert Path(directory, "llms.txt").read_text() == (
            "# Docs\n\n> Useful docs\n\n## Notes\n\n"
            "- [Home](https://example.com/docs/): Start here\n"
        )
