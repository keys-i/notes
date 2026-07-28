"""Configure local MkDocs behavior."""

import re
from html.parser import HTMLParser
from types import SimpleNamespace
from urllib.parse import urljoin, urlsplit

from mermaid2 import fence_mermaid_custom
from mkdocs.plugins import event_priority


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


@event_priority(-50)
def on_page_markdown(markdown, **_):
    """Make example callouts collapsible by default."""
    return re.sub(
        r"(?m)^([ \t]*)!!! example(?=[ \t]|$)",
        r"\1??? example",
        markdown,
    )


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


if __name__ == "__main__":    
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
