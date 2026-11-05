"""Tests for the MkDocs hooks."""

import json
import os
import runpy
import sys
import unittest
from pathlib import Path
from subprocess import CompletedProcess
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from hooks import callouts, discovery, game, graph, man, plot, typescript
from hooks import site as site_hook

ROOT = Path(__file__).resolve().parents[1]


def setup():
    return SimpleNamespace(
        config_file_path=ROOT / "site/mkdocs.yml",
        docs_dir=ROOT / "content",
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
                "attempts": 24,
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
        self.assertEqual(settings["heuristic"]["braid"]["minimum_cycle_length"], 8)
        self.assertEqual(len(settings["pickups"]["items"]), 5)
        self.assertEqual(
            sum(item["power_ticks"] > 0 for item in settings["pickups"]["items"]),
            2,
        )
        self.assertEqual(settings["play"]["extra_life_score"], 1000)

    def test_callouts(self):
        self.assertEqual(callouts.on_page_markdown("!!! example"), "??? example")

    def test_site_asset_version_tracks_deploys_and_stays_stable_locally(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertIs(site_hook.on_config(self.config), self.config)
        self.assertEqual(self.config.extra["asset_version"], "dev")

        with patch.dict(os.environ, {"GITHUB_SHA": "release/abc.123!"}, clear=True):
            site_hook.on_config(self.config)
        self.assertEqual(self.config.extra["asset_version"], "releaseabc123")

        with patch.dict(os.environ, {"GITHUB_SHA": "!!!"}, clear=True):
            site_hook.on_config(self.config)
        self.assertEqual(self.config.extra["asset_version"], "dev")

    def test_site_build_rejects_unversioned_custom_assets(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            version = "release123"
            markup = "\n".join(
                f'url="{asset}?v={version}"' for asset in site_hook.VERSIONED_ASSETS
            )
            (root / "index.html").write_text(markup, encoding="utf-8")
            config = SimpleNamespace(
                site_dir=root,
                extra={"asset_version": version},
            )
            site_hook.on_post_build(config)

            (root / "index.html").write_text(markup.replace("?v=release123", "?v=", 1))
            with self.assertRaisesRegex(RuntimeError, "built assets lack version"):
                site_hook.on_post_build(config)

    def test_game_rejects_attempt_overflow(self):
        source = (ROOT / "site/game.toml").read_text(encoding="utf-8")
        with TemporaryDirectory() as directory:
            candidate = Path(directory, "game.map.toml")
            candidate.write_text(
                source.replace("attempts = 24", "attempts = 385", 1),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "attempt range is invalid"):
                game.load_map(candidate, ROOT)

    def test_game_rejects_short_braid_cycles(self):
        source = (ROOT / "site/game.toml").read_text(encoding="utf-8")
        with TemporaryDirectory() as directory:
            candidate = Path(directory, "game.map.toml")
            candidate.write_text(
                source.replace("minimum_cycle_length = 8", "minimum_cycle_length = 7"),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "heuristic.braid is invalid"):
                game.load_map(candidate, ROOT)

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
        self.assertEqual(graph.repository_root, ROOT)
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


class DiscoveryCoverageTests(unittest.TestCase):
    def test_missing_sitemap_fails_before_writing_discovery_files(self):
        with TemporaryDirectory() as directory:
            config = SimpleNamespace(site_dir=directory)
            with self.assertRaisesRegex(RuntimeError, "sitemap.xml"):
                discovery.on_post_build(config)
            self.assertFalse(Path(directory, "robots.txt").exists())

    def test_empty_descriptions_and_markdown_titles_are_serialised(self):
        with TemporaryDirectory() as directory:
            config = SimpleNamespace(
                site_description="  Compact   notes ",
                site_dir=directory,
                site_name="Rad's Notes",
                site_url="https://example.test/",
            )
            Path(directory, "sitemap.xml").touch()
            discovery.on_pre_build()
            context = {}
            self.assertIs(
                discovery.on_page_context(
                    context,
                    SimpleNamespace(meta={}, title="  [Page]   title ", url="page/"),
                    config,
                ),
                context,
            )
            discovery.on_post_build(config)
            llms = Path(directory, "llms.txt").read_text(encoding="utf-8")
            self.assertIn("[\\[Page\\] title](https://example.test/page/)", llms)
            self.assertNotIn("page/):", llms)
            self.assertIn("> Compact notes", llms)


class GraphCoverageTests(unittest.TestCase):
    def setUp(self):
        graph.creation_dates_by_path.clear()
        graph.creation_dates_by_url.clear()
        graph.nodes_by_url.clear()
        graph.edges.clear()
        graph.seen_links = 0

    def test_link_collector_and_git_outcomes(self):
        collector = graph.LinkCollector()
        collector.feed('<div></div><a name="empty"></a><a href="/ok">ok</a>')
        self.assertEqual(collector.hrefs, ["/ok"])

        with patch.object(
            graph.subprocess,
            "run",
            return_value=CompletedProcess([], 0, "created\n", ""),
        ):
            self.assertEqual(graph.git(".", "status"), "created\n")
        with patch.object(
            graph.subprocess,
            "run",
            return_value=CompletedProcess([], 1, "ignored", ""),
        ):
            self.assertEqual(graph.git(".", "status"), "")
        with patch.object(graph.subprocess, "run", side_effect=OSError("missing")):
            self.assertEqual(graph.git(".", "status"), "")

    def test_creation_date_parsing_and_fallbacks(self):
        self.assertEqual(
            graph.parse_git_creation_dates(
                "ignored\n@@2026-01-01T00:00:00+00:00\na.md\n\n"
                "@@2025-01-01T00:00:00+00:00\nb.md\n"
            ),
            {
                "a.md": "2026-01-01T00:00:00+00:00",
                "b.md": "2025-01-01T00:00:00+00:00",
            },
        )
        with patch.object(graph, "git", return_value="new\nold\n"):
            self.assertEqual(graph.git_creation_date(".", "note.md"), "old")
        with patch.object(graph, "git", return_value=""):
            self.assertEqual(graph.git_creation_date(".", "note.md"), "")

        with TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "note.md"
            source.write_text("note", encoding="utf-8")
            graph.repository_root = root
            graph.creation_dates_by_path["note.md"] = "2026-01-01T00:00:00+00:00"
            page = SimpleNamespace(file=SimpleNamespace(abs_src_path=source))
            self.assertEqual(
                graph.page_creation_date(page), "2026-01-01T00:00:00+00:00"
            )

            outside = root.parent / "outside-note.md"
            with patch.object(
                graph, "git_creation_date", return_value="2024-01-01T00:00:00+00:00"
            ):
                outside_page = SimpleNamespace(
                    file=SimpleNamespace(abs_src_path=outside)
                )
                self.assertEqual(
                    graph.page_creation_date(outside_page),
                    "2024-01-01T00:00:00+00:00",
                )

            graph.creation_dates_by_path.clear()
            with patch.object(graph, "git_creation_date", return_value=""):
                self.assertTrue(graph.page_creation_date(page).endswith("+00:00"))
                missing = SimpleNamespace(
                    file=SimpleNamespace(abs_src_path=root / "missing.md")
                )
                self.assertEqual(graph.page_creation_date(missing), "")

    def test_build_lifecycle_without_plugin_or_page_metadata(self):
        config = SimpleNamespace()
        with patch.object(graph, "git_creation_dates", return_value={"a.md": "date"}):
            graph.on_pre_build(config)
        self.assertEqual(graph.creation_dates_by_path, {"a.md": "date"})
        context = {}
        self.assertIs(
            graph.on_page_context(context, SimpleNamespace(file=None), ignored=True),
            context,
        )
        self.assertFalse(graph.creation_dates_by_url)

    def test_page_context_content_and_graph_artifact(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            source_path = root / "source.md"
            source_path.write_text("source", encoding="utf-8")
            graph.repository_root = root
            graph.creation_dates_by_path["source.md"] = "2026-02-03T04:05:06+00:00"
            source = {"id": 0, "url": "/source/", "symbolSize": 0}
            target = {"id": 1, "url": "/target/", "symbolSize": 0}
            plugin = SimpleNamespace(
                nodes={"source": source, "target": target},
                data={"nodes": [source, target], "links": []},
                get_page_path=lambda page: page.key,
            )
            config = SimpleNamespace(
                plugins={"obsidian-interactive-graph": plugin}, site_dir=root
            )
            page = SimpleNamespace(
                abs_url="/source/",
                file=SimpleNamespace(abs_src_path=source_path),
                key="source",
                meta={},
                title=" Source   title ",
            )
            graph.on_page_context({}, page)
            self.assertEqual(
                graph.creation_dates_by_url["/source"],
                "2026-02-03T04:05:06+00:00",
            )
            graph.nodes_by_url["/target"] = target
            graph.edges.add(("0", "1"))
            html = '<a href="/target/">duplicate</a><a href="/none/">none</a>'
            self.assertEqual(graph.on_page_content(html, page, config), html)
            self.assertEqual(source["title"], "Source title •Source title")
            self.assertFalse(plugin.data["links"])

            graph.on_post_build(config)
            graph_path = root / "assets/javascripts/graph.json"
            graph_path.parent.mkdir(parents=True)
            (root / "assets/js").mkdir(parents=True)
            graph_path.write_text(
                json.dumps(
                    {
                        "nodes": [
                            {"value": "/source/#part"},
                            {"value": "/unknown/"},
                        ]
                    }
                ),
                encoding="utf-8",
            )
            graph.on_post_build(config)
            moved = json.loads(
                (root / "assets/js/graph.json").read_text(encoding="utf-8")
            )
            self.assertEqual(moved["nodes"][0]["created"], "2026-02-03T04:05:06+00:00")
            self.assertNotIn("created", moved["nodes"][1])


class ManCoverageTests(unittest.TestCase):
    def test_page_url_and_fetch_validation(self):
        url = man.page_url("man page", 1)
        self.assertIn("query=man+page", url)
        response = MagicMock()
        response.__enter__.return_value = response
        response.read.return_value = b"MAN(1)\nmanual body\n"
        with patch.object(man, "urlopen", return_value=response) as opener:
            self.assertEqual(
                man.fetch_page(("man", 1)),
                ("man", {"section": "1", "text": "MAN(1)\nmanual body"}),
            )
        self.assertEqual(opener.call_args.kwargs["timeout"], 20)

        response.read.return_value = b"WRONG\n"
        with (
            patch.object(man, "urlopen", return_value=response),
            self.assertRaisesRegex(ValueError, "did not resolve"),
        ):
            man.fetch_page(("man", 1))

    def test_refresh_writes_atomic_payload(self):
        pool = MagicMock()
        pool.__enter__.return_value = pool
        pool.map.return_value = [("man", {"section": "1", "text": "MAN(1)\nbody"})]
        with TemporaryDirectory() as directory:
            output = Path(directory, "nested/freebsd.json")
            with (
                patch.object(man, "PAGES", {"man": 1}),
                patch.object(man, "ThreadPoolExecutor", return_value=pool),
            ):
                payload = man.refresh(output)
            self.assertEqual(payload["pages"]["man"]["section"], "1")
            self.assertEqual(json.loads(output.read_text()), payload)
            self.assertFalse(output.with_suffix(".tmp").exists())

    def test_post_build_respects_ci_and_contains_refresh_failures(self):
        config = SimpleNamespace(site_dir="/site")
        with (
            patch.dict(os.environ, {}, clear=True),
            patch.object(man, "refresh") as refresh,
        ):
            man.on_post_build(config)
            refresh.assert_not_called()

        with (
            patch.dict(os.environ, {"CI": "1"}),
            patch.object(man, "refresh") as refresh,
        ):
            man.on_post_build(config)
            refresh.assert_called_once_with(Path("/site/assets/man/freebsd.json"))

        for error in (OSError("offline"), ValueError("invalid")):
            with (
                self.subTest(error=type(error).__name__),
                patch.dict(os.environ, {"CI": "1"}),
                patch.object(man, "refresh", side_effect=error),
            ):
                man.on_post_build(config)

    def test_module_entrypoint_refreshes_without_network_or_writes(self):
        pool = MagicMock()
        pool.__enter__.return_value = pool
        pool.map.return_value = []
        loaded = sys.modules.pop("hooks.man")
        try:
            with (
                patch("concurrent.futures.ThreadPoolExecutor", return_value=pool),
                patch.object(Path, "mkdir"),
                patch.object(Path, "write_text"),
                patch.object(Path, "replace"),
            ):
                runpy.run_module("hooks.man", run_name="__main__")
        finally:
            sys.modules["hooks.man"] = loaded


class PlotCoverageTests(unittest.TestCase):
    def test_parse_plot_accepts_the_bounded_contract(self):
        config = plot.parse_plot(
            json.dumps(
                {
                    "title": "  Lift curve  ",
                    "description": "  Force over time  ",
                    "data": [{"type": "scatter", "x": [0, 1], "y": [1, 2]}],
                }
            )
        )
        self.assertEqual(config["title"], "Lift curve")
        self.assertEqual(config["description"], "Force over time")
        self.assertEqual(config["layout"], {})

    def test_parse_plot_rejects_invalid_boundaries(self):
        valid = {
            "title": "Plot",
            "description": "Description",
            "data": [{"type": "scatter"}],
            "layout": {},
        }
        cases = (
            ("x" * (plot.MAX_SOURCE_BYTES + 1), "exceeds 128 KB"),
            ("{", "invalid JSON"),
            ("[]", "JSON object"),
            ({**valid, "unknown": True}, "unsupported fields: unknown"),
            ({**valid, "title": None}, "title must be a non-empty string"),
            ({**valid, "title": "   "}, "title must be a non-empty string"),
            ({**valid, "title": "x" * 121}, "title exceeds 120"),
            (
                {**valid, "description": "x" * 501},
                "description exceeds 500",
            ),
            ({**valid, "data": "trace"}, "between 1 and 16 traces"),
            ({**valid, "data": []}, "between 1 and 16 traces"),
            (
                {**valid, "data": [{"type": "scatter"}] * 17},
                "between 1 and 16 traces",
            ),
            ({**valid, "data": ["trace"]}, "trace 1 must be an object"),
            ({**valid, "data": [{"type": "pie"}]}, "unsupported type"),
            ({**valid, "layout": []}, "layout must be an object"),
        )
        for value, message in cases:
            error = (
                TypeError
                if message
                in {
                    "JSON object",
                    "trace 1 must be an object",
                    "layout must be an object",
                }
                else ValueError
            )
            with (
                self.subTest(message=message),
                self.assertRaisesRegex(error, message),
            ):
                plot.parse_plot(value if isinstance(value, str) else json.dumps(value))

    def test_format_plot_encodes_accessible_2d_and_3d_targets(self):
        for trace_type, dimension in (("bar", "2d"), ("surface", "3d")):
            with self.subTest(dimension=dimension):
                html = plot.format_plot(
                    json.dumps(
                        {
                            "title": "A < B",
                            "description": 'Force "history"',
                            "data": [{"type": trace_type}],
                            "layout": {"showlegend": False},
                        }
                    ),
                    "plot",
                    "language-plot",
                    {},
                    None,
                    unused=True,
                )
                self.assertIn(f"note-plot--{dimension}", html)
                self.assertIn("A &lt; B", html)
                self.assertIn("Force &quot;history&quot;", html)
                self.assertIn('data-state="idle"', html)
                self.assertNotIn("note-plot__control", html)


class SiteCoverageTests(unittest.TestCase):
    def test_navigation_keeps_non_weeks_stable_and_sorts_numbered_weeks(self):
        def page(title):
            return SimpleNamespace(
                children=None,
                is_page=True,
                next_page="stale",
                previous_page="stale",
                title=title,
            )

        exam, week_1, week_10, week_2 = map(page, ("Exam", "W1", "W10", "W2"))
        lectures = SimpleNamespace(
            children=[exam, week_1, week_10, week_2],
            is_page=False,
            title="Lectures",
        )
        link = SimpleNamespace(children=None, is_page=False, title="External")
        nav = SimpleNamespace(
            items=[lectures, link],
            pages=[exam, week_1, week_10, week_2],
        )

        self.assertIs(site_hook.on_nav(nav), nav)
        self.assertEqual(
            [item.title for item in lectures.children],
            ["Exam", "W1", "W2", "W10"],
        )
        self.assertEqual(
            [item.title for item in nav.pages], ["Exam", "W1", "W2", "W10"]
        )
        self.assertIsNone(exam.previous_page)
        self.assertIs(exam.next_page, week_1)
        self.assertIs(week_2.previous_page, week_1)
        self.assertIs(week_2.next_page, week_10)
        self.assertIsNone(week_10.next_page)

    def test_root_assets_add_files_once_and_ignore_directories(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            assets = root / "assets"
            (assets / "nested").mkdir(parents=True)
            (assets / "nested/new.txt").write_text("new", encoding="utf-8")
            (assets / "known.txt").write_text("known", encoding="utf-8")
            outside = root / "outside.txt"
            outside.write_text("private", encoding="utf-8")
            symlink = assets / "leak.txt"
            symlink.symlink_to(outside)
            files = [SimpleNamespace(src_uri="assets/known.txt")]
            config = SimpleNamespace(site_dir=root / "public", use_directory_urls=True)
            with (
                patch.object(site_hook, "ROOT", root),
                patch.object(site_hook, "ASSETS", assets),
            ):
                with self.assertRaisesRegex(ValueError, "asset symlinks"):
                    site_hook.on_files(files, config)
                symlink.unlink()
                self.assertIs(site_hook.on_files(files, config), files)
            self.assertEqual(
                [file.src_uri for file in files],
                ["assets/known.txt", "assets/nested/new.txt"],
            )

    def test_redirect_escapes_target_and_preserves_navigation_state(self):
        redirect = site_hook._redirect('../new?value="<unsafe>"')
        self.assertIn("&quot;&lt;unsafe&gt;&quot;", redirect)
        self.assertNotIn("<unsafe>", redirect)
        self.assertIn("location.search+location.hash", redirect)
        self.assertEqual(redirect.count("../new?value="), 4)

    def test_redirect_cannot_close_its_script(self):
        redirect = site_hook._redirect('</script><script>alert("x")</script>')
        self.assertEqual(redirect.count("</script>"), 1)
        self.assertNotIn('<script>alert("x")', redirect)

    def test_post_build_creates_only_existing_subject_redirects(self):
        with TemporaryDirectory() as directory:
            public = Path(directory)
            page = public / "COMP/4403/Lectures/index.html"
            page.parent.mkdir(parents=True)
            page.write_text("page", encoding="utf-8")
            (public / "MECH").mkdir()
            site_hook.on_post_build(SimpleNamespace(site_dir=public))
            legacy = public / "markdown/COMP/4403/Lectures/index.html"
            self.assertTrue(legacy.is_file())
            redirect = legacy.read_text(encoding="utf-8")
            self.assertIn("../../../../COMP/4403/Lectures/index.html", redirect)
            self.assertFalse((public / "markdown/INFS").exists())
            self.assertFalse((public / "markdown/MECH").exists())


class TypeScriptCoverageTests(unittest.TestCase):
    def test_pre_build_compiles_browser_source_from_the_repository_root(self):
        with patch.object(typescript, "run") as run:
            typescript.on_pre_build(ignored=True)
        run.assert_called_once_with(
            ["npm", "run", "--silent", "build:web"],
            cwd=typescript.ROOT,
            check=True,
        )


if __name__ == "__main__":
    unittest.main()
