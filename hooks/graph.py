"""Enrich and relocate the interactive graph."""

import json
import subprocess
from datetime import UTC, datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin

creation_dates_by_path = {}
creation_dates_by_url = {}
repository_root = Path.cwd()
nodes_by_url = {}
edges = set()
seen_links = 0


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


page_url = lambda url: url.partition("#")[0].partition("?")[0].rstrip("/")


def git(root, *args):
    """Run Git locally and return stdout, or nothing when unavailable."""
    try:
        result = subprocess.run(
            ("git", *args),
            cwd=root,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            check=False,
            text=True,
        )
    except OSError:
        return ""
    return result.stdout if result.returncode == 0 else ""


def parse_git_creation_dates(output):
    """Map files to their oldest addition in newest-first Git output."""
    dates = {}
    created = ""
    for line in output.splitlines():
        if line.startswith("@@"):
            created = line[2:]
        elif line and created:
            dates[line] = created
    return dates


git_creation_dates = lambda root: parse_git_creation_dates(
    git(
        root,
        "log",
        "--diff-filter=A",
        "--format=@@%aI",
        "--name-only",
        "--",
    )
)


def git_creation_date(root, path):
    """Follow a renamed file back to its first Git addition."""
    dates = git(
        root,
        "log",
        "--follow",
        "--diff-filter=A",
        "--format=%aI",
        "--",
        path,
    ).splitlines()
    return dates[-1] if dates else ""


def page_creation_date(page):
    """Return a versioned replay date, with a filesystem fallback."""
    source = Path(page.file.abs_src_path)
    try:
        relative_source = source.relative_to(repository_root).as_posix()
    except ValueError:
        relative_source = source.as_posix()

    if created := creation_dates_by_path.get(relative_source) or git_creation_date(
        repository_root, relative_source
    ):
        creation_dates_by_path[relative_source] = created
        return created

    try:
        stat = source.stat()
    except OSError:
        return ""
    return datetime.fromtimestamp(
        getattr(stat, "st_birthtime", stat.st_mtime), UTC
    ).isoformat()


def on_pre_build(config):
    global repository_root, seen_links
    creation_dates_by_url.clear()
    nodes_by_url.clear()
    edges.clear()
    seen_links = 0
    if plugin := getattr(config, "plugins", {}).get("obsidian-interactive-graph"):
        plugin.nodes.clear()
        plugin.data["nodes"].clear()
        plugin.data["links"].clear()
        plugin.current_id = 0
    config_path = getattr(config, "config_file_path", None)
    repository_root = Path(config_path).resolve().parent if config_path else Path.cwd()
    creation_dates_by_path.clear()
    creation_dates_by_path.update(git_creation_dates(repository_root))


def on_page_context(context, page, **_):
    if getattr(page, "file", None) and getattr(page, "abs_url", None):
        creation_dates_by_url[page_url(page.abs_url)] = page_creation_date(page)
    return context


def on_page_content(html, page, config, **_):
    """Add standard Markdown links to the interactive graph."""
    global seen_links
    graph = config.plugins["obsidian-interactive-graph"]
    parser = LinkCollector()
    parser.feed(html)

    source = graph.nodes[graph.get_page_path(page)]
    title = " ".join(str(page.title).split())
    source["title"] = (
        f"{' '.join(str(page.meta.get('slug') or title).split())} •{title}"
    )
    if not nodes_by_url:
        nodes_by_url.update(
            (page_url(node["url"]), node) for node in graph.nodes.values()
        )

    links = graph.data["links"]
    edges.update(
        (str(edge["source"]), str(edge["target"])) for edge in links[seen_links:]
    )

    for href in parser.hrefs:
        target = nodes_by_url.get(page_url(urljoin(page.abs_url, href)))
        if not target or target is source:
            continue

        edge = (str(source["id"]), str(target["id"]))
        if edge in edges:
            continue

        links.append({"source": edge[0], "target": edge[1]})
        source["symbolSize"] += 1
        target["symbolSize"] += 1
        edges.add(edge)

    seen_links = len(links)
    return html


def on_post_build(config):
    """Add creation dates and move the graph beside its script."""
    site_dir = Path(config.site_dir)
    graph_path = site_dir / "assets" / "javascripts" / "graph.json"
    if not graph_path.is_file():
        return

    graph = json.loads(graph_path.read_text(encoding="utf-8"))
    for node in graph.get("nodes", []):
        if created := creation_dates_by_url.get(page_url(node.get("value", ""))):
            node["created"] = created
    graph_path.write_text(
        f"{json.dumps(graph, separators=(',', ':'))}\n",
        encoding="utf-8",
    )
    graph_path.replace(site_dir / "assets" / "js" / "graph.json")
