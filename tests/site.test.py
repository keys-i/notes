"""Tests for site asset integration."""

import unittest
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

    def test_404_sound_control_is_accessible(self):
        template = (ROOT / "overrides/404.html").read_text(encoding="utf-8")
        script = (ROOT / "notes/assets/js/404/game.js").read_text(encoding="utf-8")
        shell = (ROOT / "notes/assets/js/404/shell.js").read_text(encoding="utf-8")

        for name, body, expected in (
            ("control", template, 'id="sound"'),
            ("label", template, 'aria-label="Mute game sound"'),
            ("pressed state", template, 'aria-pressed="false"'),
            ("preference", script, 'storage.getItem("404-sound-muted")'),
            ("visibility", script, 'page.addEventListener("visibilitychange"'),
            ("shell pause", shell, "gameAudio.pause()"),
            ("shell start", shell, "gameAudio.start()"),
        ):
            with self.subTest(name=name):
                self.assertIn(expected, body)
        self.assertNotIn("new Audio(", script)

    def test_dock_pet_integration(self):
        main = (ROOT / "overrides/main.html").read_text(encoding="utf-8")
        not_found = (ROOT / "overrides/404.html").read_text(encoding="utf-8")
        style = (ROOT / "notes/assets/styles/pet.css").read_text(encoding="utf-8")
        script = (ROOT / "notes/assets/js/pet.js").read_text(encoding="utf-8")
        image = ROOT / "notes/assets/images/game/koala/pet.webp"
        poses = ROOT / "notes/assets/images/game/koala/pet-poses.webp"

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
        self.assertIn("../images/game/koala/pet-poses.webp", style)
        self.assertNotIn("../images/game/koala/pet.webp", style)
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
        self.assertEqual(poses.read_bytes()[:4], b"RIFF")
        self.assertEqual(poses.read_bytes()[8:12], b"WEBP")
        self.assertLess(len(image.read_bytes()), 2_100_000)
        self.assertLess(len(poses.read_bytes()), 50_000)
        self.assertEqual(
            sha256(image.read_bytes()).hexdigest(),
            "6e29fe14706adc88d3e7ac0da5e4bec496cc9a35a2ea5f9eaa773f25065492bf",
        )
        self.assertEqual(
            sha256(poses.read_bytes()).hexdigest(),
            "1a1e50b9ff2be942e0209e3a780282982c9ad62cd63bc023586f47c0e5ead5ec",
        )


if __name__ == "__main__":
    unittest.main()
