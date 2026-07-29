"""Configure local MkDocs behavior."""

import json
import re
import subprocess
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urljoin, urlsplit

from mermaid2 import fence_mermaid_custom
from mkdocs.plugins import event_priority

pages = {}
creation_dates_by_path = {}
creation_dates_by_url = {}
repository_root = Path.cwd()


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


def parse_git_creation_dates(output):
    """Map files to the timestamp of their first Git addition."""
    dates = {}
    created = ""
    for line in output.splitlines():
        if line.startswith("@@"):
            created = line[2:]
        elif line and created:
            dates.setdefault(line, created)
    return dates


def git_creation_dates(root):
    """Read all creation dates in one local Git command."""
    try:
        result = subprocess.run(
            [
                "git",
                "log",
                "--reverse",
                "--diff-filter=A",
                "--format=@@%aI",
                "--name-only",
                "--",
            ],
            cwd=root,
            capture_output=True,
            check=False,
            text=True,
        )
    except OSError:
        return {}
    return parse_git_creation_dates(result.stdout) if result.returncode == 0 else {}


def git_creation_date(root, path):
    """Follow a renamed file back to its first Git addition."""
    try:
        result = subprocess.run(
            [
                "git",
                "log",
                "--follow",
                "--diff-filter=A",
                "--format=%aI",
                "--",
                path,
            ],
            cwd=root,
            capture_output=True,
            check=False,
            text=True,
        )
    except OSError:
        return ""
    dates = result.stdout.splitlines()
    return dates[-1] if result.returncode == 0 and dates else ""


def page_creation_date(page):
    """Return a versioned replay date, with Git and filesystem fallbacks."""
    source = Path(page.file.abs_src_path).resolve()
    try:
        relative_source = source.relative_to(repository_root).as_posix()
    except ValueError:
        relative_source = source.as_posix()

    if relative_source in creation_dates_by_path:
        return creation_dates_by_path[relative_source]

    created = git_creation_date(repository_root, relative_source)
    if created:
        creation_dates_by_path[relative_source] = created
        return created

    try:
        stat = source.stat()
    except OSError:
        return ""
    timestamp = getattr(stat, "st_birthtime", stat.st_mtime)
    return datetime.fromtimestamp(timestamp, timezone.utc).isoformat()


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


def on_pre_build(config=None, **_):
    global repository_root
    pages.clear()
    creation_dates_by_url.clear()
    if config is not None:
        config_path = getattr(config, "config_file_path", None)
        repository_root = (
            Path(config_path).resolve().parent if config_path else Path.cwd()
        )
        creation_dates_by_path.clear()
        creation_dates_by_path.update(git_creation_dates(repository_root))


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
    if getattr(page, "file", None) and getattr(page, "abs_url", None):
        creation_dates_by_url[page_url(page.abs_url)] = page_creation_date(page)
    return context


def on_page_content(html, page, config, **_):
    """Add standard Markdown links to the interactive graph."""
    graph = config.plugins["obsidian-interactive-graph"]
    parser = LinkCollector()
    parser.feed(html)

    source = graph.nodes[graph.get_page_path(page)]
    title = " ".join(str(page.title).split())
    slug = " ".join(str(page.meta.get("slug") or title).split())
    source["title"] = f"{slug} •{title}"
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
    graph_path = site_dir / "assets" / "javascripts" / "graph.json"

    if not (site_dir / "sitemap.xml").is_file():
        raise RuntimeError("MkDocs did not generate sitemap.xml")

    if graph_path.is_file():
        graph = json.loads(graph_path.read_text(encoding="utf-8"))
        for node in graph.get("nodes", []):
            created = creation_dates_by_url.get(page_url(node.get("value", "")))
            if created:
                node["created"] = created
        graph_path.write_text(
            f"{json.dumps(graph, indent=2)}\n",
            encoding="utf-8",
        )

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

    assert parse_git_creation_dates(
        "@@2025-01-02T03:04:05+00:00\n\nnotes/first.md\n"
        "@@2025-02-03T04:05:06+00:00\n\nnotes/second.md\n"
    ) == {
        "notes/first.md": "2025-01-02T03:04:05+00:00",
        "notes/second.md": "2025-02-03T04:05:06+00:00",
    }

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
        SimpleNamespace(
            abs_url="/source/",
            title="A complete page title",
            meta={"slug": "Short"},
        ),
        config,
    )
    assert graph.data["links"] == [{"source": "0", "target": "1"}]
    assert nodes["source"]["title"] == "Short •A complete page title"

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
