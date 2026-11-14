"""Enrich and relocate the interactive graph."""

import json
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin

creation_dates_by_path = {}
creation_dates_by_url = {}
repository_root = Path(__file__).parents[4]
nodes_by_url = {}
edges = set()
seen_links = 0
PAPER_ROUTE = re.compile(r"^/(?:COMP|INFS|MECH)/\d{4}/PY/?$")
COURSE_ROUTE = re.compile(r"^/(?:COMP|INFS|MECH)/\d{4}/?$")


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


def redundant_course_edge(source, target):
    """Keep course graphs hierarchical instead of drawing every cross-reference"""
    source_parts = source.strip("/").split("/")
    target_parts = target.strip("/").split("/")
    if (
        len(source_parts) < 2
        or len(target_parts) < 2
        or source_parts[:2] != target_parts[:2]
        or source_parts[0] not in {"COMP", "INFS", "MECH"}
        or not source_parts[1].isdigit()
    ):
        return False
    return not (source_parts == target_parts[:-1] or target_parts == source_parts[:-1])


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
    repository_root = (
        Path(config_path).resolve().parents[1]
        if config_path
        else Path(__file__).parents[4]
    )
    creation_dates_by_path.clear()
    creation_dates_by_path.update(git_creation_dates(repository_root))
    docs_dir = getattr(config, "docs_dir", None)
    if docs_dir and Path(docs_dir).resolve().is_relative_to(repository_root):
        missing = [
            path.relative_to(repository_root).as_posix()
            for path in Path(docs_dir).resolve().rglob("*.md")
            if path.is_file()
            and path.relative_to(repository_root).as_posix()
            not in creation_dates_by_path
        ]
        if missing:
            with ThreadPoolExecutor(max_workers=8) as pool:
                dates = pool.map(
                    lambda path: git_creation_date(repository_root, path), missing
                )
                creation_dates_by_path.update(
                    (path, date) for path, date in zip(missing, dates) if date
                )


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
    """Add course links and creation dates, then move the graph beside its script"""
    site_dir = Path(config.site_dir)
    graph_path = site_dir / "assets" / "javascripts" / "graph.json"
    if not graph_path.is_file():
        return

    graph = json.loads(graph_path.read_text(encoding="utf-8"))
    paper_ids = {
        str(node["id"])
        for node in graph.get("nodes", [])
        if PAPER_ROUTE.fullmatch(node.get("value", ""))
    }
    graph["nodes"] = [
        node for node in graph.get("nodes", []) if str(node["id"]) not in paper_ids
    ]
    nodes = {str(node["id"]): node for node in graph["nodes"]}
    connected = set()
    links = []
    for link in graph.get("links", []):
        source = str(link["source"])
        target = str(link["target"])
        edge = frozenset((source, target))
        if (
            source in paper_ids
            or target in paper_ids
            or len(edge) != 2
            or edge in connected
            or redundant_course_edge(
                nodes.get(source, {}).get("value", ""),
                nodes.get(target, {}).get("value", ""),
            )
        ):
            continue
        links.append(link)
        connected.add(edge)
    graph["links"] = links
    home = next(
        (node for node in graph["nodes"] if node.get("value") == "/"),
        None,
    )
    if home:
        home_id = str(home["id"])
        for node in graph["nodes"]:
            node_id = str(node["id"])
            edge = frozenset((home_id, node_id))
            if not COURSE_ROUTE.fullmatch(node.get("value", "")) or edge in connected:
                continue
            graph["links"].append({"source": home_id, "target": node_id})
            connected.add(edge)
    edge_counts = {node_id: 0 for node_id in nodes}
    for link in graph["links"]:
        edge_counts[str(link["source"])] += 1
        edge_counts[str(link["target"])] += 1
    for node_id, node in nodes.items():
        node["symbolSize"] = edge_counts[node_id]
    for node in graph.get("nodes", []):
        if created := creation_dates_by_url.get(page_url(node.get("value", ""))):
            node["created"] = created
    graph_path.write_text(
        f"{json.dumps(graph, separators=(',', ':'))}\n",
        encoding="utf-8",
    )
    destination = site_dir / "assets" / "js" / "page" / "graph.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    graph_path.replace(destination)
