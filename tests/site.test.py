"""Tests for site asset integration."""

import base64
import json
import os
import re
import tomllib
import unittest
import wave
from array import array
from hashlib import sha256
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from hooks import plot, site

ROOT = Path(__file__).resolve().parents[1]


class SiteAssetTests(unittest.TestCase):
    def test_recovery_music_is_a_non_clipping_loop(self):
        settings = tomllib.loads((ROOT / "site/game.toml").read_text())
        self.assertEqual(settings["assets"]["music"], "assets/audios/music.wav")
        with wave.open(str(ROOT / settings["assets"]["music"]), "rb") as audio:
            self.assertEqual(audio.getnchannels(), 1)
            self.assertEqual(audio.getsampwidth(), 2)
            self.assertEqual(audio.getframerate(), 24_000)
            self.assertGreater(audio.getnframes() / audio.getframerate(), 30)
            samples = array("h", audio.readframes(audio.getnframes()))
        self.assertLess(max(abs(value) for value in samples), 32_767)
        self.assertGreater(max(samples), 10_000)
        self.assertLess(abs(samples[0] - samples[-1]), 100)

    def test_404_assets_are_grouped(self):
        config = (ROOT / "site/mkdocs.yml").read_text(encoding="utf-8")
        template = (ROOT / "site/theme/404.html").read_text(encoding="utf-8")

        for kind, names in {
            "js": ("game", "shell", "panic"),
            "styles": ("panic", "game", "shell"),
        }.items():
            extension = "js" if kind == "js" else "css"
            for name in names:
                with self.subTest(kind=kind, name=name):
                    source = f"assets/{kind}/404/{name}.{extension}"
                    built = f"assets/{kind}/404/{name}.min.{extension}"
                    self.assertTrue((ROOT / source).is_file(), source)
                    self.assertIn(source, config)
                    self.assertIn(built, template)
                    self.assertFalse(
                        (ROOT / "assets" / kind / f"404.{name}.{extension}").exists()
                    )

    def test_404_shell_loads_local_manual_database(self):
        script = (ROOT / "assets/js/404/shell.js").read_text(encoding="utf-8")

        self.assertTrue((ROOT / "assets/man/freebsd.json").is_file())
        self.assertRegex(
            script,
            r'manualUrl:\s*new URL\(\s*"\.\./\.\./man/freebsd\.json",'
            r"\s*(?:document\.currentScript\.src|shellScriptUrl),?\s*\)\.href",
        )
        self.assertIn(
            'fetch(shell.manualUrl, { cache: "force-cache" })',
            script,
        )

    def test_404_shell_uses_vendored_runtime(self):
        template = (ROOT / "site/theme/404.html").read_text(encoding="utf-8")
        script = (ROOT / "assets/js/404/shell.js").read_text(encoding="utf-8")
        runtime = "assets/vendor/shell.js/shell.min.js"

        self.assertLess(
            template.index(runtime), template.index("assets/js/404/shell.min.js")
        )
        self.assertIn("ShellJS.createShell", script)
        self.assertIn('"krad-add": ShellJS.createKradAdd', script)
        self.assertIn("shell.engine.exec(source)", script)
        provenance = (ROOT / "assets/vendor/shell.js/SOURCE").read_text(
            encoding="utf-8"
        )
        for name in ("shell.min.js", "shell.wasm", "krad-add.wasm"):
            path = ROOT / "assets/vendor/shell.js" / name
            self.assertIn(sha256(path.read_bytes()).hexdigest(), provenance)

    def test_404_sound_control_is_accessible(self):
        template = (ROOT / "site/theme/404.html").read_text(encoding="utf-8")
        script = (ROOT / "assets/js/404/game.js").read_text(encoding="utf-8")
        shell = (ROOT / "assets/js/404/shell.js").read_text(encoding="utf-8")

        for name, body, expected in (
            ("control", template, 'id="sound"'),
            ("label", template, 'aria-label="Mute game sound"'),
            ("pressed state", template, 'aria-pressed="false"'),
            ("volume", template, 'id="volume"'),
            ("preference", script, 'storage.getItem("404-sound-muted")'),
            ("visibility", script, 'page.addEventListener("visibilitychange"'),
            ("native audio", script, "globalThis.Audio"),
            ("shell pause", shell, "gameAudio.pause()"),
            ("shell start", shell, "gameAudio.start()"),
        ):
            with self.subTest(name=name):
                self.assertIn(expected, body)
        self.assertNotIn("AudioContext", script)

    def test_active_effects_use_classic_arcade_samples(self):
        settings = tomllib.loads((ROOT / "site/game.toml").read_text())
        for name in (
            "beginning",
            "chomp",
            "death",
            "fruit",
            "ghost",
            "life",
            "intermission",
        ):
            with self.subTest(name=name):
                asset = settings["assets"][name]
                self.assertEqual(asset, f"assets/audios/{name}.wav")
                with wave.open(str(ROOT / asset), "rb") as audio:
                    self.assertEqual(audio.getnchannels(), 1)
                    self.assertIn(audio.getsampwidth(), (1, 2))
                    self.assertGreater(audio.getframerate(), 8_000)
                    self.assertGreater(audio.getnframes(), 1_000)
        self.assertNotIn("danger", settings["assets"])

    def test_countdown_and_boom_have_distinct_short_effects(self):
        settings = tomllib.loads((ROOT / "site/game.toml").read_text())
        for name, minimum, maximum in (("countdown", 0.65, 0.8), ("launch", 1.3, 1.4)):
            with self.subTest(name=name):
                asset = settings["assets"][name]
                self.assertEqual(asset, f"assets/audios/{name}.wav")
                with wave.open(str(ROOT / asset), "rb") as audio:
                    self.assertEqual(audio.getnchannels(), 1)
                    self.assertEqual(audio.getsampwidth(), 2)
                    self.assertGreater(audio.getnframes(), 1_000)
                    self.assertGreater(
                        audio.getnframes() / audio.getframerate(), minimum
                    )
                    self.assertLess(audio.getnframes() / audio.getframerate(), maximum)
                    samples = array("h", audio.readframes(audio.getnframes()))
                self.assertGreater(max(abs(value) for value in samples), 10_000)
                self.assertLess(max(abs(value) for value in samples), 32_767)
                self.assertLess(abs(samples[0] - samples[-1]), 100)

    def test_site_theme_transitions_and_graph_stay_lightweight(self):
        config = (ROOT / "site/mkdocs.yml").read_text(encoding="utf-8")
        main = (ROOT / "site/theme/main.html").read_text(encoding="utf-8")
        not_found = (ROOT / "site/theme/404.html").read_text(encoding="utf-8")
        theme = (ROOT / "assets/styles/site.css").read_text(encoding="utf-8")
        graph = (ROOT / "assets/js/graph.js").read_text(encoding="utf-8")

        self.assertNotIn("extra_css:", config)
        self.assertIn("assets/styles/site.min.css?v=", main)
        self.assertIn("assets/js/graph.min.js?v=", main)
        self.assertIn("@view-transition", theme)
        self.assertIn("prefers-reduced-motion: reduce", theme)
        self.assertIn('[data-md-color-scheme="default"]', theme)
        self.assertIn('[data-md-color-scheme="slate"]', theme)
        self.assertIn(".md-header__inner > .md-search:focus-within", theme)
        self.assertIn("transform: translateX(-50%)", theme)
        self.assertIn("body:has(.papers__preview:not([hidden])) #dock-pet", theme)
        self.assertIn("text: IBM Plex Sans", config)
        self.assertIn("code: IBM Plex Mono", config)
        self.assertNotIn("language:", config)
        self.assertNotIn("og:locale", main)
        self.assertNotIn("inLanguage", main)
        self.assertNotIn("assets/js/freebsd.boot.min.js", main)
        self.assertIn("assets/js/freebsd.boot.min.js", not_found)
        self.assertNotIn("graph-preview", graph)
        self.assertNotIn("IntersectionObserver", graph)
        self.assertEqual(graph.count("load_echarts()"), 2)

    def test_external_code_is_pinned_and_integrity_checked(self):
        config = (ROOT / "site/mkdocs.yml").read_text(encoding="utf-8")
        main = (ROOT / "site/theme/main.html").read_text(encoding="utf-8")
        graph = (ROOT / "site/ts/graph.ts").read_text(encoding="utf-8")
        math = (ROOT / "site/ts/math.ts").read_text(encoding="utf-8")
        workflows = "".join(
            path.read_text(encoding="utf-8")
            for path in (ROOT / ".github/workflows").glob("*.yml")
        )

        self.assertIn("mermaid@11.16.1", config)
        self.assertNotIn("mermaid@10.4.0", config)
        self.assertIn("assets/js/math.min.js", main)
        self.assertIn("generic: true", config)
        self.assertIn("mathjax@3.2.2", math)
        self.assertNotIn("MathJax/2.7.0", math)
        self.assertRegex(math, r'script\.integrity\s*=\s*\n\s*"sha384-')
        self.assertIn("window.notesMath", math)
        self.assertIn('root.querySelector(".arithmatex")', math)
        self.assertIn("script.integrity = ECHARTS_INTEGRITY", graph)
        self.assertIn('script.crossOrigin = "anonymous"', graph)
        self.assertNotRegex(workflows, r"uses: [^\n]+@v\d")
        self.assertIn("persist-credentials: false", workflows)

    def test_plot_fences_support_2d_and_3d_data(self):
        cases = (
            (
                "2d",
                [{"type": "scatter", "x": [0, 1], "y": [0, 1]}],
            ),
            (
                "3d",
                [{"type": "surface", "z": [[0, 0], [0, 1]]}],
            ),
        )
        for dimension, data in cases:
            with self.subTest(dimension=dimension):
                rendered = plot.format_plot(
                    json.dumps(
                        {
                            "title": f"{dimension} example",
                            "description": f"Accessible {dimension} example",
                            "data": data,
                            "layout": {},
                        }
                    ),
                    "plot",
                    "note-plot",
                    {},
                    None,
                )
                encoded = re.search(r'data-plot="([^"]+)"', rendered).group(1)
                decoded = json.loads(base64.b64decode(encoded).decode("utf-8"))
                self.assertEqual(decoded["data"], data)
                self.assertIn(f"note-plot--{dimension}", rendered)
                self.assertIn('tabindex="0"', rendered)
                self.assertNotIn("note-plot__control", rendered)

    def test_plot_fences_reject_malformed_data(self):
        valid = {
            "title": "Example",
            "description": "Accessible example",
            "data": [{"type": "scatter", "x": [0], "y": [0]}],
        }
        for source, message, error in (
            (" " * (plot.MAX_SOURCE_BYTES + 1), "exceeds 128 KB", ValueError),
            ("{", "invalid JSON", ValueError),
            ("[]", "JSON object", TypeError),
            (json.dumps({**valid, "title": ""}), "non-empty string", ValueError),
            (json.dumps({**valid, "title": "x" * 121}), "exceeds 120", ValueError),
            (
                json.dumps({**valid, "description": None}),
                "non-empty string",
                ValueError,
            ),
            (json.dumps({**valid, "extra": True}), "unsupported fields", ValueError),
            (json.dumps({**valid, "data": []}), "between 1 and 16", ValueError),
            (json.dumps({**valid, "data": ["trace"]}), "must be an object", TypeError),
            (
                json.dumps({**valid, "data": [{"type": "pie"}]}),
                "unsupported type",
                ValueError,
            ),
            (
                json.dumps({**valid, "layout": []}),
                "layout must be an object",
                TypeError,
            ),
        ):
            with self.subTest(message=message), self.assertRaisesRegex(error, message):
                plot.parse_plot(source)

    def test_plot_runtime_is_conditional_and_lazy(self):
        config = (ROOT / "site/mkdocs.yml").read_text(encoding="utf-8")
        main = (ROOT / "site/theme/main.html").read_text(encoding="utf-8")
        script = (ROOT / "site/ts/plot.ts").read_text(encoding="utf-8")
        style = (ROOT / "assets/styles/plot.css").read_text(encoding="utf-8")

        self.assertIn("hooks.plot.format_plot", config)
        self.assertIn("assets/js/plot.js", config)
        self.assertIn("assets/styles/plot.css", config)
        self.assertIn("{% if has_plot %}", main)
        self.assertIn("assets/js/plot.min.js", main)
        self.assertIn("assets/styles/plot.min.css", main)
        self.assertIn("IntersectionObserver", script)
        self.assertIn("plotly-3.1.2.min.js", script)
        self.assertIn("script.integrity = PLOTLY_INTEGRITY", script)
        self.assertIn("prefers-reduced-motion: reduce", script)
        self.assertIn('console.error("Interactive graph failed", error)', script)
        self.assertIn("margin: { b: 44, l: 52, pad: 0, r: 16, t: 16 }", script)
        self.assertIn("width: 100%", style)
        self.assertIn(".md-typeset > .note-plot", style)
        self.assertIn("max-width: 100%", style)
        self.assertIn("height: 24rem", style)
        self.assertIn(".note-plot .modebar-btn", style)
        self.assertNotIn("min-height: 24rem", style)
        self.assertNotIn("eval(", script)

    def test_dock_pet_integration(self):
        config = (ROOT / "site/mkdocs.yml").read_text(encoding="utf-8")
        main = (ROOT / "site/theme/main.html").read_text(encoding="utf-8")
        artwork = (ROOT / "site/theme/partials/koala.html").read_text(encoding="utf-8")
        not_found = (ROOT / "site/theme/404.html").read_text(encoding="utf-8")

        self.assertIn('{% include "partials/koala.html" %}', main)
        self.assertIn("assets/styles/pet.min.css", main)
        self.assertIn("assets/js/pet.min.js", main)
        self.assertIn('aria-label="Ask the koala study buddy"', main)
        self.assertIn('data-endpoint="/api/pet"', main)
        self.assertNotIn('href="https://uni.keysi.dev/mini/"', main)
        self.assertNotIn('aria-label="Close study helper"', main)
        self.assertIn("link: https://uni.keysi.dev/mini/", config)
        self.assertIn("name: Minis", config)
        self.assertIn('id="dock-pet-thread"', main)
        self.assertIn('class="dock-pet__status"', main)
        self.assertNotIn("dock-pet", not_found)
        self.assertEqual(artwork.count('class="dock-pet__paw '), 4)
        self.assertEqual(artwork.count('class="dock-pet__iris"'), 2)
        self.assertNotIn('class="dock-pet__limb ', artwork)
        self.assertNotIn("<canvas", artwork)

    def test_deployed_assets_are_versioned_without_changing_local_urls(self):
        config = SimpleNamespace(extra={})
        with patch.dict(os.environ, {}, clear=True):
            self.assertIs(site.on_config(config), config)
        self.assertEqual(config.extra["asset_version"], "dev")

        with patch.dict(os.environ, {"GITHUB_SHA": "release/abc.123!"}, clear=True):
            site.on_config(config)
        self.assertEqual(config.extra["asset_version"], "releaseabc123")

        main = (ROOT / "site/theme/main.html").read_text(encoding="utf-8")
        for asset in ("site", "graph", "pet"):
            self.assertIn(f"assets/styles/{asset}.min.css?v=", main)
        for asset in ("comments", "graph", "math", "pet"):
            self.assertIn(f"assets/js/{asset}.min.js?v=", main)

    def test_paper_pages_use_curated_course_folders_and_safe_file_links(self):
        catalog = site.PAPERS["courses"]
        self.assertEqual(set(catalog), {"INFS2200", "MECH2700", "COMP4403", "COMP4702"})
        for code, course in catalog.items():
            with self.subTest(course=code):
                subject, number = code[:4], code[4:]
                page = ROOT / "content" / subject / number / "PY/index.md"
                self.assertIn(f"papers: {code}", page.read_text(encoding="utf-8"))
                self.assertTrue(course["items"])
                self.assertTrue(
                    course["folder"].startswith(
                        "https://drive.google.com/drive/folders/"
                    )
                )
                self.assertTrue(all(item["year"] >= 2000 for item in course["items"]))
                self.assertTrue(
                    all(
                        item["url"].startswith(
                            (
                                "https://docs.google.com/document/d/",
                                "https://drive.google.com/file/d/",
                            )
                        )
                        for item in course["items"]
                    )
                )
                context = site.on_page_context(
                    {}, SimpleNamespace(meta={"papers": code})
                )
                self.assertEqual(context["paper_catalog"]["folder"], course["folder"])
                self.assertTrue(context["paper_catalog"]["items"])
                self.assertTrue(
                    all(
                        item["has_solutions"]
                        for item in context["paper_catalog"]["items"]
                    )
                )
                self.assertTrue(
                    all(
                        item["display_title"]
                        for item in context["paper_catalog"]["items"]
                    )
                )
                body = site.on_page_markdown("", SimpleNamespace(meta={"papers": code}))
                self.assertIn("Solutions and worked answers", body)
                self.assertIn(f"Back to {code}", body)
        self.assertEqual(
            {item["source"] for item in catalog["MECH2700"]["items"]}, {"fallback"}
        )
        infs = site.on_page_context({}, SimpleNamespace(meta={"papers": "INFS2200"}))[
            "paper_catalog"
        ]["items"]
        exam_2019 = [
            item
            for item in infs
            if item["year"] == 2019 and item["display_title"] == "Exam with answers"
        ]
        self.assertEqual(len(exam_2019), 1)
        self.assertEqual(exam_2019[0]["source"], "primary")

    def test_course_cheatsheets_keep_cs_urls_and_ship_one_pdf_each(self):
        for code, filename in site.CHEATSHEETS.items():
            with self.subTest(course=code):
                subject, number = code[:4], code[4:]
                course = ROOT / "content" / subject / number
                route = course / "CS/index.md"
                pdf = route.with_name(filename)
                source = ROOT / "site/cheatsheets" / f"{code.lower()}.typ"

                self.assertIn(f"cheatsheet: {code}", route.read_text(encoding="utf-8"))
                self.assertIn(
                    "[Cheatsheet](CS/index.md)", (course / "index.md").read_text()
                )
                self.assertTrue(source.is_file())
                self.assertTrue(pdf.read_bytes().startswith(b"%PDF-"))
                self.assertGreater(pdf.stat().st_size, 100_000)

                body = site.on_page_markdown(
                    "", SimpleNamespace(meta={"cheatsheet": code})
                )
                self.assertIn(filename, body)
                self.assertIn("one-page exam reference", body)

    def test_paper_titles_remove_file_noise_but_keep_cross_year_context(self):
        cases = (
            (
                "MECH2700",
                "Semester_Two_Final_Examinations__2018_MECH2700_415.pdf",
                2018,
                "Paper",
                "Semester Two Final Examinations with answers",
            ),
            (
                "COMP4702",
                "COMP4702-7703-FinalExam_solutions23.pdf",
                2023,
                "Solution",
                "Final Exam Solutions",
            ),
            ("INFS2200", "2022.pdf", 2022, "Paper", "Exam with answers"),
            (
                "MECH2700",
                "MECH2700 - 2016 and 2017 Exam Solutions.PDF",
                2016,
                "Solution",
                "2016 and 2017 Exam Solutions",
            ),
        )
        for code, title, year, kind, expected in cases:
            with self.subTest(title=title):
                self.assertEqual(
                    site.paper_display_title(
                        {"title": title, "year": year, "kind": kind}, code
                    ),
                    expected,
                )


if __name__ == "__main__":
    unittest.main()
