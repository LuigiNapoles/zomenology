"""Descarga las tipografías de Google Fonts (solo subconjunto latino) para autoalojarlas.

Uso: py scripts/fetch_fonts.py
Escribe public/fonts/*.woff2 y src/themes/fonts.css. Solo hace falta repetirlo si cambian las fuentes.
"""

from __future__ import annotations

import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = ROOT / "public" / "fonts"
CSS_PATH = ROOT / "src" / "themes" / "fonts.css"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
)

# Familia → parámetro de pesos para la API css2 de Google Fonts.
# Interfaz y eje: Source Sans 3. Títulos y ficha: Source Serif 4 (estilo editorial, cálido).
FAMILIES = {
    "Source Sans 3": "wght@400..700",
    "Source Serif 4": "wght@400..700",
}


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def main() -> None:
    FONT_DIR.mkdir(parents=True, exist_ok=True)
    blocks = [
        "/* Generado por scripts/fetch_fonts.py: tipografías de Google Fonts (SIL OFL 1.1),\n"
        "   autoalojadas, solo subconjunto latino. */",
    ]
    for family, axis in FAMILIES.items():
        query = family.replace(" ", "+") + (f":{axis}" if axis else "")
        css = fetch(f"https://fonts.googleapis.com/css2?family={query}&display=swap").decode()
        match = re.search(r"/\* latin \*/\s*@font-face\s*\{(.*?)\}", css, re.S)
        if not match:
            sys.exit(f"Sin subconjunto latino para {family}")
        body = match.group(1)
        url = re.search(r"url\((https://[^)]+\.woff2)\)", body)
        weight = re.search(r"font-weight:\s*([^;]+);", body)
        urange = re.search(r"unicode-range:\s*([^;]+);", body)
        if not (url and weight and urange):
            sys.exit(f"Formato inesperado para {family}")
        name = f"{slug(family)}.woff2"
        data = fetch(url.group(1))
        (FONT_DIR / name).write_bytes(data)
        print(f"{family}: {len(data) // 1024} KB")
        blocks.append(
            "@font-face {\n"
            f"  font-family: '{family}';\n"
            "  font-style: normal;\n"
            f"  font-weight: {weight.group(1).strip()};\n"
            "  font-display: swap;\n"
            f"  src: url('/fonts/{name}') format('woff2');\n"
            f"  unicode-range: {urange.group(1).strip()};\n"
            "}"
        )
    CSS_PATH.write_text("\n\n".join(blocks) + "\n", encoding="utf-8")
    (FONT_DIR / "LICENCIAS.txt").write_text(
        "Tipografías de Google Fonts bajo la SIL Open Font License 1.1 "
        "(https://openfontlicense.org):\n"
        + "\n".join(f"- {f}" for f in FAMILIES)
        + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    main()
