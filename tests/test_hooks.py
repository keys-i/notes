"""Tests for the MkDocs hooks."""

import json
import unittest
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


class HookTests(unittest.TestCase):
    def setUp(self):
        self.config = setup()

    def test_game_config(self):
        settings = game.on_config(self.config).extra["game"]
        self.assertEqual(
            settings["map"],
            {
                "columns": 21,
                "rows": 15,
                "attempts": 96,
                "maximum_attempts": 384,
                "minimum_path": 36,
                "maximum_path": 90,
                "minimum_cycles": 7,
                "minimum_junctions": 12,
                "route_options": 2,
            },
        )
        self.assertEqual(set(settings["random"]["streams"].values()), set(range(7)))
        self.assertEqual(
            settings["heuristic"]["strict"],
            {
                "minimum_turns": 9,
                "maximum_straight": 7,
                "maximum_dead_ends": 6,
                "maximum_four_ways": 6,
                "maximum_chambers": 18,
            },
        )
        self.assertEqual(len(settings["pickups"]["items"]), 5)
        self.assertEqual(
            sum(item["power_ticks"] > 0 for item in settings["pickups"]["items"]),
            2,
        )
        self.assertEqual(settings["play"]["extra_life_score"], 1000)

    def test_callouts(self):
        self.assertEqual(callouts.on_page_markdown("!!! example"), "??? example")

    def test_game_rejects_attempt_overflow(self):
        source = (ROOT / "notes/assets/game.map.toml").read_text(encoding="utf-8")
        with TemporaryDirectory() as directory:
            candidate = Path(directory, "game.map.toml")
            candidate.write_text(
                source.replace("attempts = 96", "attempts = 385", 1),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "attempt range is invalid"):
                game.load_map(candidate, ROOT / "notes")

    def test_graph_links(self):
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
        self.config.plugins = {"obsidian-interactive-graph": plugin}
        graph.on_pre_build(self.config)
        self.assertFalse(plugin.nodes)
        self.assertEqual(plugin.data, {"nodes": [], "links": []})
        self.assertEqual(plugin.current_id, 0)
        plugin.nodes.update(nodes)
        graph.on_page_content(
            """
            <a href="/target/#first">Target</a>
            <a href="/target/?again=1">Duplicate</a>
            <a href="/source/">Self</a>
            <a href="https://example.test/outside/">External</a>
            """,
            SimpleNamespace(
                key="source",
                abs_url="/source/",
                title="Source Title",
                meta={"slug": "source slug"},
            ),
            self.config,
        )
        self.assertEqual(plugin.data["links"], [{"source": "0", "target": "1"}])
        self.assertEqual(nodes["source"]["symbolSize"], 1)
        self.assertEqual(nodes["target"]["symbolSize"], 1)
        self.assertEqual(nodes["source"]["title"], "source slug •Source Title")

    def test_discovery(self):
        with TemporaryDirectory() as directory:
            self.config.site_dir = directory
            Path(directory, "sitemap.xml").touch()
            discovery.on_pre_build()
            discovery.on_page_context(
                {},
                SimpleNamespace(url="page/", title="Page", meta={}),
                self.config,
            )
            discovery.on_post_build(self.config)
            self.assertIn(
                "https://example.test/page/",
                Path(directory, "llms.txt").read_text(encoding="utf-8"),
            )

    def test_man_cache(self):
        data = json.loads(man.CACHE.read_text(encoding="utf-8"))
        self.assertEqual(data["release"], man.RELEASE)
        self.assertEqual(data["aliases"], man.ALIASES)
        self.assertEqual(set(data["pages"]), set(man.PAGES))
        self.assertTrue(data["pages"]["man"]["text"].startswith("MAN(1)"))
