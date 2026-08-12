"""Tests for site asset integration."""

import unittest
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
                source = f"assets/{kind}/404/{name}.{extension}"
                built = f"assets/{kind}/404/{name}.min.{extension}"
                self.assertTrue((ROOT / "notes" / source).is_file(), source)
                self.assertIn(source, config)
                self.assertIn(built, template)
                self.assertFalse(
                    (ROOT / "notes/assets" / kind / f"404.{name}.{extension}").exists()
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
        self.assertIn('id="dock-pet"', main)
        self.assertIn("hidden", main)
        self.assertNotIn("dock-pet", not_found)
        self.assertIn(".dock-pet:focus-visible", style)
        self.assertIn("../images/game/koala/pet.webp", style)
        self.assertIn("@keyframes dock-pet-walk", style)
        self.assertIn("@keyframes dock-pet-climb", style)
        self.assertIn(".dock-pet__bubble::before", style)
        self.assertIn("prefers-reduced-motion: no-preference", style)
        self.assertIn("html.freebsd-booting .dock-pet", style)
        self.assertIn("html.freebsd-shutting-down .dock-pet", style)
        self.assertIn("@media print", style)
        self.assertIn('window.matchMedia("(prefers-reduced-motion: reduce)")', script)
        self.assertIn('document.querySelector(".md-footer")', script)
        self.assertIn(
            'document.querySelector(".utterances-frame, .giscus-frame")', script
        )
        self.assertIn('document.getElementById("graph_button")', script)
        self.assertIn('document.addEventListener("visibilitychange"', script)
        self.assertIn("dockPetDialogue", script)
        self.assertNotIn("jump", script.lower())
        self.assertEqual(image.read_bytes()[:4], b"RIFF")
        self.assertEqual(image.read_bytes()[8:12], b"WEBP")


if __name__ == "__main__":
    unittest.main()
