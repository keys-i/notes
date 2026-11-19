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

from hooks import cheatsheets
from hooks.content import plot
from hooks.publish import site
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]


class SiteAssetTests(unittest.TestCase):
    def test_recovery_music_is_a_non_clipping_loop(self):
        settings = tomllib.loads((ROOT / "site/config/game.toml").read_text())
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
        template = (ROOT / "site/web/theme/404.html").read_text(encoding="utf-8")

        groups = (
            (
                "js",
                "recovery",
                ROOT / "assets/js/recovery",
                ("game", "shell", "panic"),
            ),
            (
                "styles",
                "404",
                ROOT / "site/web/styles/404",
                ("panic", "game", "shell"),
            ),
        )
        for kind, group, source_root, names in groups:
            extension = "js" if kind == "js" else "css"
            for name in names:
                with self.subTest(kind=kind, name=name):
                    public = f"assets/{kind}/{group}/{name}.{extension}"
                    built = f"assets/{kind}/{group}/{name}.min.{extension}"
                    self.assertTrue((source_root / f"{name}.{extension}").is_file())
                    self.assertIn(public, config)
                    self.assertIn(built, template)
                    self.assertFalse(
                        (ROOT / "assets" / kind / f"404.{name}.{extension}").exists()
                    )

    def test_404_shell_loads_manuals_from_the_worker(self):
        script = (ROOT / "assets/js/recovery/shell.js").read_text(encoding="utf-8")

        self.assertFalse((ROOT / "assets/man/freebsd.json").exists())
        self.assertIn('new URL("/api/manuals/freebsd", shellScriptUrl)', script)
        self.assertIn(
            'fetch(shell.manualUrl, { cache: "force-cache" })',
            script,
        )

    def test_404_shell_uses_vendored_runtime(self):
        template = (ROOT / "site/web/theme/404.html").read_text(encoding="utf-8")
        script = (ROOT / "assets/js/recovery/shell.js").read_text(encoding="utf-8")
        runtime = "assets/vendor/shell.js/shell.min.js"

        self.assertLess(
            template.index(runtime),
            template.index("assets/js/recovery/shell.min.js"),
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
        template = (ROOT / "site/web/theme/404.html").read_text(encoding="utf-8")
        script = (ROOT / "assets/js/recovery/game.js").read_text(encoding="utf-8")
        shell = (ROOT / "assets/js/recovery/shell.js").read_text(encoding="utf-8")

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
        settings = tomllib.loads((ROOT / "site/config/game.toml").read_text())
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
        settings = tomllib.loads((ROOT / "site/config/game.toml").read_text())
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
        main = (ROOT / "site/web/theme/main.html").read_text(encoding="utf-8")
        not_found = (ROOT / "site/web/theme/404.html").read_text(encoding="utf-8")
        theme = (ROOT / "site/web/styles/site.css").read_text(encoding="utf-8")
        graph = (ROOT / "assets/js/page/graph.js").read_text(encoding="utf-8")

        self.assertNotIn("extra_css:", config)
        self.assertIn("assets/styles/site.min.css?v=", main)
        self.assertIn("assets/js/page/graph.min.js?v=", main)
        self.assertIn("@view-transition", theme)
        self.assertIn("prefers-reduced-motion: reduce", theme)
        self.assertIn('[data-md-color-scheme="default"]', theme)
        self.assertIn('[data-md-color-scheme="slate"]', theme)
        self.assertIn(".md-header__inner > .md-search:focus-within", theme)
        self.assertIn("transform: translateX(-50%)", theme)
        self.assertIn("body:has(.papers__preview:not([hidden])) #dock-pet", theme)
        self.assertIn("body:has(.cheatsheet) .md-sidebar--secondary", theme)
        self.assertIn(".md-content__inner:has(.cheatsheet) > h1", theme)
        self.assertIn("text: IBM Plex Sans", config)
        self.assertIn("code: IBM Plex Mono", config)
        self.assertNotIn("language:", config)
        self.assertNotIn("og:locale", main)
        self.assertNotIn("inLanguage", main)
        self.assertNotIn("assets/js/recovery/boot.min.js", main)
        self.assertIn("assets/js/recovery/boot.min.js", not_found)
        self.assertNotIn("graph-preview", graph)
        self.assertNotIn("IntersectionObserver", graph)
        self.assertEqual(graph.count("load_echarts()"), 2)

    def test_adaptive_colours_use_the_native_colour_scheme(self):
        styles = {
            path.name: path.read_text(encoding="utf-8")
            for path in (
                ROOT / "site/web/styles/site.css",
                ROOT / "site/web/styles/graph.css",
                ROOT / "site/web/styles/pet.css",
                ROOT / "site/web/styles/study/courses.css",
            )
        }

        for name, source in styles.items():
            with self.subTest(name=name):
                self.assertIn("light-dark(", source)
        self.assertIn("color-scheme: light", styles["site.css"])
        self.assertIn("color-scheme: dark", styles["site.css"])
        for name in ("graph.css", "pet.css", "courses.css"):
            self.assertNotIn('[data-md-color-scheme="slate"]', styles[name])
        self.assertEqual(
            styles["site.css"].count('[data-md-color-scheme="slate"]'),
            1,
        )

    def test_external_code_is_pinned_and_integrity_checked(self):
        config = (ROOT / "site/mkdocs.yml").read_text(encoding="utf-8")
        main = (ROOT / "site/web/theme/main.html").read_text(encoding="utf-8")
        graph = (ROOT / "site/web/browser/page/graph.ts").read_text(encoding="utf-8")
        math = (ROOT / "site/web/browser/page/math.ts").read_text(encoding="utf-8")
        workflows = "".join(
            path.read_text(encoding="utf-8")
            for path in (ROOT / ".github/workflows").glob("*.yml")
        )

        self.assertIn("mermaid@11.16.1", config)
        self.assertNotIn("mermaid@10.4.0", config)
        self.assertIn("assets/js/page/math.min.js", main)
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
        main = (ROOT / "site/web/theme/main.html").read_text(encoding="utf-8")
        script = (ROOT / "site/web/browser/page/plot.ts").read_text(encoding="utf-8")
        style = (ROOT / "site/web/styles/plot.css").read_text(encoding="utf-8")

        self.assertIn("hooks.content.plot.format_plot", config)
        self.assertIn("assets/js/page/plot.js", config)
        self.assertIn("assets/styles/plot.css", config)
        self.assertIn("{% if has_plot %}", main)
        self.assertIn("assets/js/page/plot.min.js", main)
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
        main = (ROOT / "site/web/theme/main.html").read_text(encoding="utf-8")
        artwork = (ROOT / "site/web/theme/partials/koala.html").read_text(
            encoding="utf-8"
        )
        not_found = (ROOT / "site/web/theme/404.html").read_text(encoding="utf-8")

        self.assertIn('{% include "partials/koala.html" %}', main)
        self.assertIn("assets/styles/pet.min.css", main)
        self.assertIn("assets/js/study/koala.min.js", main)
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

        main = (ROOT / "site/web/theme/main.html").read_text(encoding="utf-8")
        for asset in ("site", "graph", "pet"):
            self.assertIn(f"assets/styles/{asset}.min.css?v=", main)
        for asset in ("comments", "graph", "math"):
            self.assertIn(f"assets/js/page/{asset}.min.js?v=", main)
        self.assertIn("assets/js/study/koala.min.js?v=", main)

    def test_paper_pages_use_curated_course_folders_and_safe_file_links(self):
        source = ROOT / "site/config/papers.toml"
        catalog = tomllib.loads(source.read_text(encoding="utf-8"))["courses"]
        self.assertEqual(set(catalog), {"INFS2200", "MECH2700", "COMP4403", "COMP4702"})
        for code, course in catalog.items():
            with self.subTest(course=code):
                subject, number = code[:4], code[4:]
                page = ROOT / "content" / subject / number / "PastYears/index.md"
                self.assertIn(f"papers: {code}", page.read_text(encoding="utf-8"))
                self.assertTrue(course["items"])
                self.assertNotIn("https://", course["folder-code"])
                self.assertTrue(all(item["year"] >= 2000 for item in course["items"]))
                self.assertTrue(
                    all(
                        "url" not in item
                        and item["url-code"].startswith(("document/", "file/"))
                        for item in course["items"]
                    )
                )
                context = site.on_page_context(
                    {}, SimpleNamespace(meta={"papers": code})
                )
                self.assertEqual(context["paper_catalog"], {"course": code})
                body = site.on_page_markdown("", SimpleNamespace(meta={"papers": code}))
                self.assertNotIn("Solutions and worked answers", body)
                self.assertIn(f"Back to {code}", body)
        self.assertEqual(
            {item.get("source", "fallback") for item in catalog["MECH2700"]["items"]},
            {"fallback"},
        )

    def test_course_cheatsheets_generate_named_runtime_assets(self):
        ignored = (ROOT / ".gitignore").read_text(encoding="utf-8")
        self.assertIn("/content/*/*/Cheatsheets/cheatsheet.pdf", ignored)
        self.assertIn("/content/*/*/Cheatsheets/cheatsheet-preview.webp", ignored)
        for route in sorted((ROOT / "content").glob("*/*/Cheatsheets/index.md")):
            code = route.parents[2].name + route.parents[1].name
            filename = site.CHEATSHEET_PDF
            with self.subTest(course=code):
                course = route.parent.parent
                pdf = route.with_name(filename)
                preview = route.with_name(f"{pdf.stem}-preview.webp")
                source = ROOT / "assets/cheatsheets" / f"{code.lower()}.typ"

                self.assertIn(f"cheatsheet: {code}", route.read_text(encoding="utf-8"))
                self.assertIn(
                    "[Cheatsheets](Cheatsheets/index.md)",
                    (course / "index.md").read_text(),
                )
                self.assertTrue(source.is_file())
                cheatsheets.build(source, pdf, preview, ROOT)
                pdf_bytes = pdf.read_bytes()
                self.assertTrue(pdf_bytes.startswith(b"%PDF-"))
                page_count = 2 if code == "INFS2200" else 1
                self.assertIn(f"/Type/Pages/Count {page_count}/".encode(), pdf_bytes)
                self.assertTrue(pdf_bytes.rstrip().endswith(b"%%EOF"))
                with Image.open(preview) as image:
                    self.assertEqual(image.format, "WEBP")
                    if page_count == 1:
                        self.assertGreater(image.width, image.height)
                    else:
                        self.assertGreater(image.height, image.width)
                    image.verify()
                template_text = (ROOT / "assets/cheatsheets/template.typ").read_text(
                    encoding="utf-8"
                )
                self.assertIn("column-count: 3", template_text)
                self.assertIn("columns(column-count", template_text)
                self.assertIn("flipped: true", template_text)
                self.assertNotIn("EXAM CHEATSHEET", template_text)
                self.assertNotIn("Write the symbolic form first", template_text)

                body = site.on_page_markdown(
                    "", SimpleNamespace(meta={"cheatsheet": code})
                )
                self.assertIn('href="cheatsheet.pdf"', body)
                self.assertIn('src="cheatsheet-preview.webp"', body)
                self.assertNotIn(f"{code}-cheatsheet", body)
                self.assertNotIn("printable formula sheet", body)

    def test_mech2700_practicals_ship_solved_pdfs_and_plain_python(self):
        config = tomllib.loads(
            (ROOT / "site/config/materials.toml").read_text(encoding="utf-8")
        )
        catalogue = next(
            item
            for item in config["catalogues"]
            if item["course"] == "MECH2700" and item["type"] == "prac"
        )
        self.assertEqual(catalogue["route"], "/MECH/2700/Practicals/")
        self.assertEqual(len(catalogue["items"]), 12)
        self.assertTrue((ROOT / "assets/materials/mech2700/prac/handout.typ").is_file())

        typst_count = 0
        for item in catalogue["items"]:
            page_route = ROOT / "content" / item["page"].strip("/")
            page = page_route.parent / f"{page_route.name}.md"
            python = ROOT / item["python"].removeprefix("/")
            page_text = page.read_text(encoding="utf-8")

            self.assertTrue(page.is_file())
            self.assertTrue(python.is_file())
            self.assertNotIn(".adv.py", item["python"])
            self.assertIn(item["python"].removeprefix("/"), page_text)
            self.assertIn(
                f'``` {{ .python title="{python.name}" linenums="1" }}', page_text
            )

            if typst_route := item.get("typst"):
                typst_count += 1
                typst = ROOT / typst_route.removeprefix("/")
                pdf = ROOT / "content" / item["pdf"].removeprefix("/")
                self.assertTrue(typst.is_file())
                typst_text = typst.read_text(encoding="utf-8")
                self.assertIn('#import "handout.typ"', typst_text)
                self.assertNotRegex(typst_text, r"\b[0-9]+(?: [0-9]{3})+\b")
                self.assertTrue(pdf.read_bytes().startswith(b"%PDF-"))
                self.assertGreater(pdf.stat().st_size, 20_000)
                self.assertIn(pdf.name, page_text)

        self.assertEqual(typst_count, 11)
        self.assertFalse(any((ROOT / "assets/materials").rglob("*.adv.py")))
        self.assertIn(
            "[Practicals](Practicals/index.md)",
            (ROOT / "content/MECH/2700/index.md").read_text(encoding="utf-8"),
        )

    def test_mech2700_workshops_use_the_contact_session_material(self):
        workshop = ROOT / "content/MECH/2700/Workshops"
        index = (workshop / "index.md").read_text(encoding="utf-8")
        week4 = (workshop / "W4.md").read_text(encoding="utf-8")
        week9 = (workshop / "W9.md").read_text(encoding="utf-8")

        self.assertIn("slug: Workshops", index)
        self.assertIn("fit_vortex_pressure.py", week4)
        self.assertIn("minimum_width", week4)
        self.assertIn("LBM_opt.npz", week9)
        self.assertIn("10^5\\hat p(a)", week9)
        self.assertNotIn("outer diameter", week9.lower())

    def test_mech2700_math(self):
        for week in (6, 9):
            with self.subTest(week=week):
                lecture = (ROOT / f"content/MECH/2700/Lectures/W{week}.md").read_text(
                    encoding="utf-8"
                )
                self.assertNotRegex(lecture, r"(?m)^>?\s*=\s*$")

    def test_paper_library_uses_one_natural_language_search(self):
        template = (ROOT / "site/web/theme/partials/papers.html").read_text(
            encoding="utf-8"
        )
        self.assertIn('id="papers-search"', template)
        self.assertIn("latest paper", template)
        self.assertRegex(template, r">\s*Open source</a\s*>")
        self.assertNotIn("Open source ↗", template)
        self.assertNotIn("Paper not loading", template)
        self.assertNotIn("papers__years", template)

    def test_paper_titles_are_direct_human_labels(self):
        config = tomllib.loads(
            (ROOT / "site/config/papers.toml").read_text(encoding="utf-8")
        )
        titles = [
            item["title"]
            for course in config["courses"].values()
            for item in course["items"]
        ]
        self.assertIn("2016 and 2017 Exam Solutions", titles)
        self.assertIn("Final Exam Solutions", titles)
        self.assertTrue(
            all(not title.lower().endswith((".pdf", ".docx")) for title in titles)
        )


if __name__ == "__main__":
    unittest.main()
