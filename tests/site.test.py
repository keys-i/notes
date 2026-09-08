"""Tests for site asset integration."""

import tomllib
import unittest
import wave
from array import array
from pathlib import Path

ROOT = Path(__file__).parents[1]


class SiteAssetTests(unittest.TestCase):
    def test_recovery_music_is_a_non_clipping_loop(self):
        settings = tomllib.loads((ROOT / "notes/assets/game.map.toml").read_text())
        with wave.open(
            str(ROOT / "notes" / settings["assets"]["music"]), "rb"
        ) as audio:
            self.assertEqual(audio.getnchannels(), 1)
            self.assertEqual(audio.getsampwidth(), 2)
            self.assertEqual(audio.getframerate(), 24_000)
            self.assertGreater(audio.getnframes() / audio.getframerate(), 30)
            samples = array("h", audio.readframes(audio.getnframes()))
        self.assertLess(max(abs(value) for value in samples), 32_767)
        self.assertGreater(max(samples), 10_000)
        self.assertLess(abs(samples[0] - samples[-1]), 100)

    def test_404_assets_are_grouped(self):
        config = (ROOT / "mkdocs.yml").read_text(encoding="utf-8")
        template = (ROOT / "overrides/404.html").read_text(encoding="utf-8")

        for kind, names in {
            "js": ("game", "shell", "panic"),
            "styles": ("panic", "game", "shell"),
        }.items():
            extension = "js" if kind == "js" else "css"
            for name in names:
                with self.subTest(kind=kind, name=name):
                    source = f"assets/{kind}/404/{name}.{extension}"
                    built = f"assets/{kind}/404/{name}.min.{extension}"
                    self.assertTrue((ROOT / "notes" / source).is_file(), source)
                    self.assertIn(source, config)
                    self.assertIn(built, template)
                    self.assertFalse(
                        (
                            ROOT / "notes/assets" / kind / f"404.{name}.{extension}"
                        ).exists()
                    )

    def test_404_shell_loads_local_manual_database(self):
        script = (ROOT / "notes/assets/js/404/shell.js").read_text(encoding="utf-8")

        self.assertTrue((ROOT / "notes/assets/man/freebsd.json").is_file())
        self.assertRegex(
            script,
            r'manualUrl:\s*new URL\(\s*"\.\./\.\./man/freebsd\.json",'
            r"\s*document\.currentScript\.src,?\s*\)\.href",
        )
        self.assertIn("fetch(shell.manualUrl)", script)

    def test_404_shell_uses_vendored_runtime(self):
        template = (ROOT / "overrides/404.html").read_text(encoding="utf-8")
        script = (ROOT / "notes/assets/js/404/shell.js").read_text(encoding="utf-8")
        runtime = "assets/vendor/shell.js/shell.min.js"

        self.assertLess(
            template.index(runtime), template.index("assets/js/404/shell.min.js")
        )
        self.assertIn("ShellJS.createShell", script)
        self.assertIn('"krad-add": ShellJS.createKradAdd', script)
        self.assertIn("shell.engine.exec(source)", script)
        provenance = (ROOT / "notes/assets/vendor/shell.js/SOURCE").read_text(
            encoding="utf-8"
        )
        for name in ("shell.min.js", "shell.wasm", "krad-add.wasm"):
            path = ROOT / "notes/assets/vendor/shell.js" / name
            self.assertIn(sha256(path.read_bytes()).hexdigest(), provenance)

    def test_404_sound_control_is_accessible(self):
        template = (ROOT / "overrides/404.html").read_text(encoding="utf-8")
        script = (ROOT / "notes/assets/js/404/game.js").read_text(encoding="utf-8")
        shell = (ROOT / "notes/assets/js/404/shell.js").read_text(encoding="utf-8")
        style = (ROOT / "notes/assets/styles/404/game.css").read_text(encoding="utf-8")

        for name, body, expected in (
            ("control", template, 'id="sound"'),
            ("label", template, 'aria-label="Mute game sound"'),
            ("pressed state", template, 'aria-pressed="false"'),
            ("volume", template, 'id="volume"'),
            ("preference", script, 'storage.getItem("404-sound-muted")'),
            ("visibility", script, 'page.addEventListener("visibilitychange"'),
            ("native audio", script, "globalThis.Audio"),
            ("hover volume", style, ".score__audio:hover .score__volume"),
            ("connected volume", style, "bottom: 100%"),
            ("shell pause", shell, "gameAudio.pause()"),
            ("shell start", shell, "gameAudio.start()"),
        ):
            with self.subTest(name=name):
                self.assertIn(expected, body)
        self.assertNotIn("AudioContext", script)

    def test_active_effects_use_classic_arcade_samples(self):
        settings = tomllib.loads((ROOT / "notes/assets/game.map.toml").read_text())
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
                self.assertIn("pacman_", asset)
                self.assertNotIn("meow", asset)
                with wave.open(str(ROOT / "notes" / asset), "rb") as audio:
                    self.assertEqual(audio.getnchannels(), 1)
                    self.assertIn(audio.getsampwidth(), (1, 2))
                    self.assertGreater(audio.getframerate(), 8_000)
                    self.assertGreater(audio.getnframes(), 1_000)
        self.assertNotIn("danger", settings["assets"])

    def test_countdown_and_boom_have_distinct_short_effects(self):
        settings = tomllib.loads((ROOT / "notes/assets/game.map.toml").read_text())
        for name, minimum, maximum in (("countdown", 0.65, 0.8), ("launch", 1.3, 1.4)):
            with self.subTest(name=name):
                asset = settings["assets"][name]
                self.assertNotIn("pacman_", asset)
                self.assertNotIn("meow", asset)
                with wave.open(str(ROOT / "notes" / asset), "rb") as audio:
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

    def test_dock_pet_integration(self):
        main = (ROOT / "overrides/main.html").read_text(encoding="utf-8")
        artwork = (ROOT / "overrides/partials/koala.html").read_text(encoding="utf-8")
        self.assertIn('{% include "partials/koala.html" %}', main)
        main = main.replace('{% include "partials/koala.html" %}', artwork)
        not_found = (ROOT / "overrides/404.html").read_text(encoding="utf-8")
        style = (ROOT / "notes/assets/styles/pet.css").read_text(encoding="utf-8")
        script = (ROOT / "notes/assets/js/pet.js").read_text(encoding="utf-8")

        for expected in (
            "assets/styles/pet.min.css",
            "assets/js/pet.min.js",
            'aria-label="Greet the KoalaBSD dock pet"',
            'class="dock-pet__status"',
            'class="dock-pet__body" aria-hidden="true"',
            'class="dock-pet__art"',
            'class="dock-pet__cloud"',
            'id="dock-pet"',
            "hidden",
        ):
            with self.subTest(expected=expected):
                self.assertIn(expected, main)
        self.assertEqual(main.count('class="dock-pet__limb '), 4)
        self.assertEqual(main.count('class="dock-pet__iris"'), 2)
        self.assertEqual(main.count('clip-path="url(#dock-pet-eye-'), 2)
        self.assertNotIn("<canvas", main)
        self.assertNotIn("pet.webp", main)
        self.assertNotIn("dock-pet", not_found)
        self.assertIn(".dock-pet:focus-visible", style)
        self.assertIn('.dock-pet[data-direction="right"] .dock-pet__art', style)
        self.assertNotIn("url(", style)
        self.assertNotIn("pet-poses.webp", style)
        self.assertFalse((ROOT / "notes/assets/images/game/koala/pet.webp").exists())
        self.assertFalse(
            (ROOT / "notes/assets/images/game/koala/pet-poses.webp").exists()
        )
        self.assertLess(
            style.index('.dock-pet[data-state="hanging"] .dock-pet__art'),
            style.index("@media (min-width: 60em)"),
        )
        self.assertIn("--dock-pet-cloud-fill: #343940", style)
        self.assertIn("--dock-pet-cloud-fill: #fff", style)
        self.assertIn("--dock-pet-cloud-text: #202124", style)
        self.assertIn("text-wrap: pretty", style)
        self.assertIn("@keyframes dock-pet-step-a", style)
        self.assertIn("@keyframes dock-pet-climb-fore-a", style)
        self.assertIn("@keyframes dock-pet-breathe", style)
        self.assertIn("@keyframes dock-pet-hang-sway", style)
        self.assertIn('[data-state="sitting"] .dock-pet__rump', style)
        self.assertIn('[data-state="sitting"] .dock-pet__limb--fore-near', style)
        self.assertIn(".dock-pet__thought-tail::before", style)
        self.assertIn("prefers-reduced-motion: no-preference", style)
        self.assertIn("html.freebsd-booting .dock-pet", style)
        self.assertIn("html.freebsd-shutting-down .dock-pet", style)
        self.assertIn("@media print", style)
        self.assertIn('window.matchMedia("(prefers-reduced-motion: reduce)")', script)
        self.assertIn('document.querySelector(".md-footer")', script)
        self.assertIn("https://dummyjson.com/quotes/random", script)
        self.assertIn('"dock-pet-position-v1"', script)
        self.assertIn('window.addEventListener("pointermove"', script)
        self.assertIn("dockPetGaze", script)
        self.assertIn("dockPetCloudPath", script)
        self.assertIn('iris.setAttribute(\n          "transform"', script)
        self.assertNotIn("new Image", script)
        self.assertNotIn("drawImage", script)
        self.assertIn('document.addEventListener("visibilitychange"', script)
        self.assertIn("dockPetDialogue", script)
        self.assertNotIn("jump", script.lower())


if __name__ == "__main__":
    unittest.main()
