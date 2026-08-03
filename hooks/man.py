"""Cache FreeBSD 14.2 manual pages for the static recovery shell."""

import json
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

RELEASE = "FreeBSD 14.2-RELEASE"
SOURCE = "https://cgit.freebsd.org/src/tree/share/man?h=releng/14.2"
RENDERER = "https://man.freebsd.org/cgi/man.cgi"
PAGES = {
    "apropos": 1,
    "builtin": 1,
    "camcontrol": 8,
    "cat": 1,
    "clear": 1,
    "crashinfo": 8,
    "date": 1,
    "ddb": 4,
    "df": 1,
    "dmesg": 8,
    "echo": 1,
    "env": 1,
    "freebsd-version": 1,
    "fsck": 8,
    "geom": 8,
    "gpart": 8,
    "hostname": 1,
    "id": 1,
    "ifconfig": 8,
    "iostat": 8,
    "kenv": 1,
    "kldload": 8,
    "kldstat": 8,
    "kldunload": 8,
    "ls": 1,
    "man": 1,
    "mount": 8,
    "netstat": 1,
    "printenv": 1,
    "procstat": 1,
    "ps": 1,
    "pwd": 1,
    "reboot": 8,
    "rescue": 8,
    "route": 8,
    "savecore": 8,
    "service": 8,
    "sh": 1,
    "shutdown": 8,
    "sockstat": 1,
    "swapctl": 8,
    "sysctl": 8,
    "sysrc": 8,
    "top": 1,
    "uname": 1,
    "uptime": 1,
    "vmstat": 8,
    "which": 1,
    "whoami": 1,
    "zfs": 8,
    "zpool": 8,
}
ALIASES = {
    "bt": "ddb",
    "cd": "builtin",
    "exit": "builtin",
    "help": "man",
    "recovery": "rescue",
    "swapinfo": "swapctl",
    "trace": "ddb",
}
CACHE = Path(__file__).parents[1] / "notes/assets/man/freebsd.json"


def page_url(name, section):
    return f"{RENDERER}?{
        urlencode(
            {
                'query': name,
                'sektion': section,
                'manpath': RELEASE,
                'format': 'ascii',
            }
        )
    }"


def fetch_page(item):
    name, section = item
    request = Request(
        page_url(name, section), headers={"User-Agent": "keys-i-notes/404"}
    )
    with urlopen(request, timeout=20) as response:
        text = response.read().decode("utf-8").strip()
    if f"({section})" not in text.splitlines()[0]:
        raise ValueError(f"{name}({section}) did not resolve")
    return name, {"section": str(section), "text": text}


def refresh(path=CACHE):
    with ThreadPoolExecutor(max_workers=6) as pool:
        pages = dict(pool.map(fetch_page, PAGES.items()))
    payload = {
        "release": RELEASE,
        "source": SOURCE,
        "renderer": RENDERER,
        "aliases": ALIASES,
        "pages": pages,
    }
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(
        json.dumps(payload, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)
    return payload


def on_post_build(config):
    """Refresh the deploy artifact; keep the checked-in snapshot on failure."""
    if not os.getenv("CI"):
        return
    try:
        refresh(Path(config.site_dir) / "assets/man/freebsd.json")
    except (OSError, ValueError):
        pass


if __name__ == "__main__":
    refresh()
