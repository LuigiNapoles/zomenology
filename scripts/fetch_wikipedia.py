"""Busca en la Wikipedia en español los eventos cuya descripción es exactamente el título de un
artículo (o de una redirección a uno) y anota sus visitas de los últimos 30 días.

Uso: py scripts/fetch_wikipedia.py
Lee public/data/events.json (ejecuta antes scripts/build_data.py) y escribe
data/wikipedia_candidatos.csv, ordenado por visitas. Solo hace falta repetirlo si cambian los
datos; build_data.py usa después data/wikipedia.csv (los elegidos) para añadir los enlaces.

Criterio prudente para no poner enlaces equivocados: solo coincidencias exactas de título
(sin distinguir la primera mayúscula), nunca búsquedas aproximadas, y sin páginas de
desambiguación.
"""

from __future__ import annotations

import csv
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EVENTS = ROOT / "public" / "data" / "events.json"
OUT = ROOT / "data" / "wikipedia_candidatos.csv"
API = "https://es.wikipedia.org/w/api.php"
# Identificación genérica del script (sin datos personales).
UA = "cronologia-datos/1.0 (script local de un proyecto educativo)"
BATCH = 50
MAX_TITLE = 80
FORBIDDEN = set("#<>[]{}|_")


def api(params: dict[str, str]) -> dict:
    query = urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"})
    request = urllib.request.Request(f"{API}?{query}", headers={"User-Agent": UA})
    for attempt in range(8):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.loads(response.read().decode())
        except urllib.error.HTTPError as error:
            # 429: el servidor pide ir más despacio; se espera lo que indique (o más cada vez).
            if error.code != 429 or attempt == 7:
                raise
            wait = int(error.headers.get("Retry-After") or 0) or 10 * (attempt + 1)
            print(f"\n  Wikipedia pide esperar {wait} s…", end="")
            time.sleep(wait)
        except urllib.error.URLError:
            if attempt == 7:
                raise
            time.sleep(5 * (attempt + 1))
    return {}


def candidate_title(description: str) -> str | None:
    title = " ".join(description.split())
    if not title or len(title) > MAX_TITLE or FORBIDDEN & set(title):
        return None
    return title


def resolve(titles: list[str]) -> dict[str, dict]:
    """Título del evento → {article, fragment, views} para los que existen y no son desambiguación."""
    params = {
        "action": "query",
        "titles": "|".join(titles),
        "redirects": "1",
        "prop": "pageprops|pageviews",
        "ppprop": "disambiguation",
        "pvipdays": "30",
    }
    pages: dict[str, dict] = {}
    normalized: dict[str, str] = {}
    redirects: dict[str, tuple[str, str]] = {}
    while True:
        data = api(params)
        q = data.get("query", {})
        for n in q.get("normalized", []):
            normalized[n["from"]] = n["to"]
        for r in q.get("redirects", []):
            redirects[r["from"]] = (r["to"], r.get("tofragment", ""))
        for page in q.get("pages", []):
            if page.get("missing") or page.get("invalid"):
                continue
            if "disambiguation" in page.get("pageprops", {}):
                continue
            views = sum(v or 0 for v in (page.get("pageviews") or {}).values())
            current = pages.get(page["title"], {"views": 0})
            pages[page["title"]] = {"views": max(views, current["views"])}
        if "continue" not in data:
            break
        params.update(data["continue"])
        time.sleep(1.0)
    out: dict[str, dict] = {}
    for title in titles:
        t = normalized.get(title, title)
        fragment = ""
        if t in redirects:
            t, fragment = redirects[t]
        if t in pages:
            out[title] = {"article": t, "fragment": fragment, "views": pages[t]["views"]}
    return out


def main() -> None:
    if not EVENTS.exists():
        sys.exit("Falta public/data/events.json: ejecuta antes «py scripts/build_data.py».")
    events = json.loads(EVENTS.read_text(encoding="utf-8"))["events"]
    by_title: dict[str, list[dict]] = {}
    for e in events:
        title = candidate_title(e["d"])
        if title:
            by_title.setdefault(title, []).append(e)
    titles = list(by_title)
    print(f"{len(events)} eventos; {len(titles)} descripciones posibles como título.")
    found: dict[str, dict] = {}
    for start in range(0, len(titles), BATCH):
        found.update(resolve(titles[start : start + BATCH]))
        print(f"\r{min(start + BATCH, len(titles))}/{len(titles)} consultados", end="")
        time.sleep(1.5)
    print()
    rows = []
    for title, info in found.items():
        for e in by_title[title]:
            rows.append(
                {
                    "id": e["id"],
                    "descripcion": e["d"],
                    "articulo": info["article"],
                    "seccion_articulo": info["fragment"],
                    "visitas_30d": info["views"],
                }
            )
    rows.sort(key=lambda r: (-r["visitas_30d"], r["id"]))
    with OUT.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]) if rows else ["id"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"{len(rows)} eventos con artículo en Wikipedia → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    main()
