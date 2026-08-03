"""Run one smoke check per MkDocs hook."""

import json
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

from hooks import callouts, discovery, game, graph, man

ROOT = Path(__file__).parents[1]


def setup():
    return SimpleNamespace(
        config_file_path=ROOT / "mkdocs.yml",
        docs_dir=ROOT / "notes",
        extra={},
        site_description="Notes",
        site_name="Rad's Notes",
        site_url="https://example.test",
    )


def test_game(config):
    assert game.on_config(config).extra["game"]["map"]["columns"] == 21
    assert config.extra["game"]["landmark"]["mask"] == [
        "#.#.#####.#.#",
        "###.#...#.###",
        "..#.##.##...#",
    ]


def test_callouts(_):
    assert callouts.on_page_markdown("!!! example") == "??? example"


def test_graph(config):
    nodes = {
        "source": {"id": 0, "url": "/source/", "symbolSize": 0},
        "target": {"id": 1, "url": "/target/", "symbolSize": 0},
    }
    plugin = SimpleNamespace(
        nodes={"stale": {}},
        data={"nodes": [{}], "links": [{}]},
        current_id=1,
        get_page_path=lambda page: page.key,
    )
    config.plugins = {"obsidian-interactive-graph": plugin}
    graph.on_pre_build(config)
    assert not plugin.nodes and plugin.data == {"nodes": [], "links": []}
    plugin.nodes.update(nodes)
    graph.on_page_content(
        '<a href="/target/">Target</a>',
        SimpleNamespace(key="source", abs_url="/source/", title="Source", meta={}),
        config,
    )
    assert plugin.data["links"] == [{"source": "0", "target": "1"}]


def test_discovery(config):
    with TemporaryDirectory() as directory:
        config.site_dir = directory
        Path(directory, "sitemap.xml").touch()
        discovery.on_pre_build()
        discovery.on_page_context(
            {},
            SimpleNamespace(url="page/", title="Page", meta={}),
            config,
        )
        discovery.on_post_build(config)
        assert "https://example.test/page/" in Path(directory, "llms.txt").read_text(
            encoding="utf-8"
        )


def test_man(_):
    data = json.loads(man.CACHE.read_text(encoding="utf-8"))
    assert data["release"] == man.RELEASE
    assert data["aliases"] == man.ALIASES
    assert set(data["pages"]) == set(man.PAGES)
    assert data["pages"]["man"]["text"].startswith("MAN(1)")


def main():
    config = setup()
    for test in (test_game, test_callouts, test_graph, test_discovery, test_man):
        test(config)
    print("hooks: ok")


if __name__ == "__main__":
    main()
