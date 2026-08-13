"""Tests for site asset integration."""

import unittest
import wave
from hashlib import sha256
from pathlib import Path

ROOT = Path(__file__).parents[1]


class SiteAssetTests(unittest.TestCase):
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
        self.assertIn("shell.engine.exec(source)", script)

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

    def test_meow_audio_assets_are_browser_ready(self):
        for name in (
            "beginning",
            "chomp",
            "danger",
            "death",
            "fruit",
            "ghost",
            "launch",
            "life",
        ):
            with self.subTest(name=name):
                path = ROOT / f"notes/assets/audios/meow_{name}.wav"
                self.assertTrue(path.is_file())
                with wave.open(str(path), "rb") as audio:
                    self.assertEqual(audio.getnchannels(), 1)
                    self.assertEqual(audio.getsampwidth(), 2)
                    self.assertEqual(audio.getframerate(), 24_000)
                    self.assertGreater(audio.getnframes(), 9_000)

    def test_dock_pet_integration(self):
        main = (ROOT / "overrides/main.html").read_text(encoding="utf-8")
        not_found = (ROOT / "overrides/404.html").read_text(encoding="utf-8")
        style = (ROOT / "notes/assets/styles/pet.css").read_text(encoding="utf-8")
        script = (ROOT / "notes/assets/js/pet.js").read_text(encoding="utf-8")
        image = ROOT / "notes/assets/images/game/koala/pet.webp"

        self.assertIn("assets/styles/pet.min.css", main)
        self.assertIn("assets/js/pet.min.js", main)
        self.assertIn('aria-label="Greet the KoalaBSD dock pet"', main)
        self.assertIn('class="dock-pet__status"', main)
        self.assertIn('class="dock-pet__body" aria-hidden="true"', main)
        self.assertIn('class="dock-pet__look"', main)
        self.assertIn('class="dock-pet__cloud"', main)
        self.assertIn("assets/images/game/koala/pet.webp", main)
        self.assertNotIn("dock-pet__motion", main)
        self.assertNotIn('class="dock-pet__eyes"', main)
        self.assertIn('id="dock-pet"', main)
        self.assertIn("hidden", main)
        self.assertNotIn("dock-pet", not_found)
        self.assertIn(".dock-pet:focus-visible", style)
        self.assertIn('.dock-pet[data-direction="right"] .dock-pet__body', style)
        self.assertNotIn('.dock-pet[data-direction="left"] .dock-pet__body', style)
        self.assertIn("../images/game/koala/pet.webp", style)
        self.assertNotIn("pet-poses.webp", style)
        self.assertFalse(
            (ROOT / "notes/assets/images/game/koala/pet-poses.webp").exists()
        )
        self.assertLess(
            style.index('.dock-pet[data-state="hanging"] .dock-pet__body'),
            style.index("@media (min-width: 60em)"),
        )
        self.assertIn("--dock-pet-cloud-fill: #343940", style)
        self.assertIn("--dock-pet-cloud-fill: #fff", style)
        self.assertIn("--dock-pet-cloud-text: #202124", style)
        self.assertIn("text-wrap: pretty", style)
        self.assertIn("@keyframes dock-pet-walk", style)
        self.assertIn("@keyframes dock-pet-climb", style)
        self.assertIn("@keyframes dock-pet-breathe", style)
        self.assertIn("@keyframes dock-pet-hang-sway", style)
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
        self.assertIn("dockPetFrame", script)
        self.assertIn("DOCK_PET_FRAME_COUNT =", script)
        self.assertIn("DOCK_PET_TRANSITION_FRAMES = 100", script)
        self.assertIn("dockPetCloudPath", script)
        self.assertIn("lookContext.drawImage", script)
        self.assertIn("lookContext.ellipse", script)
        self.assertIn('document.addEventListener("visibilitychange"', script)
        self.assertIn("dockPetDialogue", script)
        self.assertNotIn("jump", script.lower())
        self.assertEqual(image.read_bytes()[:4], b"RIFF")
        self.assertEqual(image.read_bytes()[8:12], b"WEBP")
        header = image.read_bytes()[:30]
        self.assertEqual(
            (
                1 + int.from_bytes(header[24:27], "little"),
                1 + int.from_bytes(header[27:30], "little"),
            ),
            (3200, 6400),
        )
        self.assertLess(len(image.read_bytes()), 5_000_000)
        self.assertEqual(
            sha256(image.read_bytes()).hexdigest(),
            "b4c4a25e00b5f34513e0f5829c5c71a12c5016b6ae843faeb0131efbf9ef2acb",
        )


if __name__ == "__main__":
    unittest.main()
