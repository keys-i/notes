"""Build course cheatsheet assets before MkDocs collects content"""

import re
from pathlib import Path
from subprocess import run
from tempfile import TemporaryDirectory

from PIL import Image

ROOT = Path(__file__).parents[3]
PDF = "cheatsheet.pdf"
PREVIEW = "cheatsheet-preview.webp"
COURSE = re.compile(r"(?m)^cheatsheet:\s*([A-Z]{4}[0-9]{4})\s*$")


def jobs(root=ROOT):
    """Return each Typst source and its course-local generated outputs"""
    queued = []
    for page in sorted((root / "content").glob("*/*/Cheatsheets/index.md")):
        match = COURSE.search(page.read_text(encoding="utf-8"))
        if not match:
            raise ValueError(f"cheatsheet page has no course code: {page}")
        code = match[1]
        route_code = page.parents[2].name + page.parents[1].name
        if code != route_code:
            raise ValueError(f"cheatsheet course does not match its route: {page}")
        source = root / "assets/cheatsheets" / f"{code.lower()}.typ"
        if not source.is_file():
            raise FileNotFoundError(f"cheatsheet source does not exist: {source}")
        queued.append((source, page.with_name(PDF), page.with_name(PREVIEW)))
    return tuple(queued)


def _install(source, target):
    generated = source.read_bytes()
    if target.is_file() and target.read_bytes() == generated:
        return
    target.write_bytes(generated)


def build(source, pdf, preview, root=ROOT):
    """Compile one source into stable course-local PDF and WebP assets"""
    with TemporaryDirectory() as directory:
        temporary = Path(directory)
        generated_pdf = temporary / PDF
        generated_png = temporary / "cheatsheet-{p}.png"
        generated_preview = temporary / PREVIEW
        run(
            [
                "typst",
                "compile",
                "--root",
                str(root),
                str(source),
                str(generated_pdf),
            ],
            cwd=root,
            check=True,
        )
        run(
            [
                "typst",
                "compile",
                "--root",
                str(root),
                "--format",
                "png",
                "--ppi",
                "192",
                str(source),
                str(generated_png),
            ],
            cwd=root,
            check=True,
        )
        pages = sorted(
            temporary.glob("cheatsheet-*.png"),
            key=lambda path: int(path.stem.rsplit("-", 1)[1]),
        )
        if not pages:
            raise RuntimeError(f"Typst generated no preview pages for {source}")
        with Image.open(pages[0]) as first:
            if len(pages) == 1:
                first.save(generated_preview, "WEBP", quality=86, method=6)
            else:
                with Image.new(
                    "RGB", (first.width, first.height * len(pages)), "#fffefa"
                ) as preview_image:
                    for number, page in enumerate(pages):
                        with Image.open(page) as image:
                            if image.size != first.size:
                                raise ValueError("cheatsheet preview pages must match")
                            preview_image.paste(image, (0, number * first.height))
                    preview_image.save(generated_preview, "WEBP", quality=86, method=6)
        _install(generated_pdf, pdf)
        _install(generated_preview, preview)


def on_pre_build(**_):
    for source, pdf, preview in jobs(ROOT):
        build(source, pdf, preview, ROOT)
