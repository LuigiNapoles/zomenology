"""Convierte data/cronologia.csv en public/data/events.json y undated.json.

Uso: py scripts/build_data.py
También escribe data/build_report.md con los recuentos de la limpieza.
"""

from __future__ import annotations

import gzip
import json
import sys
from collections import Counter
from datetime import date
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "data" / "cronologia.csv"
OUT_DIR = ROOT / "public" / "data"
REPORT_PATH = ROOT / "data" / "build_report.md"
# Enlaces a Wikipedia elegidos (ver scripts/fetch_wikipedia.py): id, articulo, seccion_articulo.
WIKI_PATH = ROOT / "data" / "wikipedia.csv"

PRESENT_REF = 2027  # «ya» = 2027 − inicio

MACROS = [
    "Tiempo profundo",
    "Paleolítico",
    "Neolítico",
    "Próximo Oriente antiguo",
    "Antigüedad",
    "Mundo clásico",
    "Edad Media",
    "Edad Moderna",
    "Edad Contemporánea",
    "Mundo extraeuropeo",
    "Geografía",
    "Temas",
]

# Asignación sección → macrocategoría (índice en MACROS), por prefijo del nombre.
# El orden importa: «Antigua próx oriente» va antes que «Antigua (».
SECTION_RULES: list[tuple[str, int]] = [
    ("Prehistoria (", 0),
    ("Paleolítico ", 1),
    ("Neolítico ", 2),
    ("Antigua próx oriente ", 3),
    ("Antigua (", 4),
    ("Clásica (", 5),
    ("Medieval (", 6),
    ("Moerna (", 7),
    ("Contempt (", 8),
    ("América (", 9),
    ("Asia (", 9),
    ("África (", 9),
    ("Historia extraeuropea (", 9),
    ("Geografía (", 10),
]
THEME_SECTIONS = {
    "Historia Arte",
    "Historia Literatura",
    "Ciencia pura y medicina",
    "Ciencia aplicada (ingeniería y tecnología)",
    "Historia, filosofía y pensamiento",
    "Biblia",
    "Historia España",
}

# Únicas correcciones de texto permitidas: erratas en el nombre de sección.
LABEL_FIXES = [("Contempt ", "Contemporánea "), ("Moerna ", "Moderna ")]

TIPO_CODES = {"evento": "e", "vida": "v", "muerte": "m", "floruit": "f", "nacimiento": "n"}

# Correcciones puntuales aprobadas: fechas mal leídas del PDF que se deducen de `fecha_texto`.
# id → (valores esperados en el CSV, valores corregidos, motivo).
MANUAL_FIXES: dict[int, tuple[dict[str, str], dict[str, str], str]] = {
    2869: (
        {"fecha_texto": "30/03-22/05/1282", "inicio": "30", "mes_inicio": "", "dia_inicio": ""},
        {"inicio": "1282", "mes_inicio": "3", "dia_inicio": "30"},
        "Día leído como año («30/03-22/05/1282»): `inicio` = 1282, 30 de marzo",
    ),
    6121: (
        {"fecha_texto": "10-11/06/1329", "mes_inicio": "10", "dia_inicio": ""},
        {"mes_inicio": "6", "dia_inicio": "10"},
        "Día leído como mes («10-11/06/1329»): inicio el 10 de junio",
    ),
}

MINOR_REVIEW = {"era supuesta", "escala supuesta", "formato complejo", "fecha con alternativas"}
UNDATED_REVIEW = "sin fecha al final"
INVERTED_REVIEW = "inicio posterior al fin"


class BuildError(Exception):
    pass


def macro_for(section: str) -> int:
    if section in THEME_SECTIONS:
        return 11
    for prefix, macro in SECTION_RULES:
        if section.startswith(prefix):
            return macro
    raise BuildError(f"Sección sin macrocategoría: {section!r}")


def label_for(section: str) -> str:
    for wrong, right in LABEL_FIXES:
        if section.startswith(wrong):
            return right + section[len(wrong):]
    return section


def is_open_range(fecha_texto: str) -> bool:
    return fecha_texto.rstrip().endswith(("-", "–"))


def to_int(value: str) -> int | None:
    return int(value) if value != "" else None


def build() -> None:
    # Todo como texto para no perder nada; se convierte campo a campo.
    df = pd.read_csv(CSV_PATH, encoding="utf-8-sig", dtype=str, keep_default_na=False)
    rows_read = len(df)

    for fix_id, (expected, fixed, _) in MANUAL_FIXES.items():
        mask = df["id"] == str(fix_id)
        if mask.sum() != 1:
            raise BuildError(f"Corrección manual: no existe el id {fix_id}")
        for col, value in expected.items():
            current = df.loc[mask, col].iloc[0]
            if current != value:
                raise BuildError(f"Corrección manual id {fix_id}: {col} vale {current!r}, se esperaba {value!r}")
        for col, value in fixed.items():
            df.loc[mask, col] = value

    # Secciones en orden de primera aparición en el CSV.
    section_names = list(dict.fromkeys(df["seccion"]))
    sections = [{"name": s, "label": label_for(s), "macro": macro_for(s)} for s in section_names]
    section_index = {s: i for i, s in enumerate(section_names)}

    excluded: Counter[str] = Counter()
    fixes: Counter[str] = Counter()
    fixed_ids: dict[str, list[int]] = {}
    events: list[dict[str, object]] = []
    undated: list[dict[str, object]] = []

    def note(kind: str, row_id: int) -> None:
        fixes[kind] += 1
        fixed_ids.setdefault(kind, []).append(row_id)

    for row in df.itertuples(index=False):
        row_id = int(row.id)
        if row.duplicado_de != "":
            excluded["Duplicado (`duplicado_de` relleno)"] += 1
            continue

        if row_id in MANUAL_FIXES:
            note(MANUAL_FIXES[row_id][2], row_id)

        ev: dict[str, object] = {
            "id": row_id,
            "s": section_index[row.seccion],
            "d": row.descripcion,
        }
        if row.fecha_texto != "":
            ev["f"] = row.fecha_texto
        if row.tipo_fecha != "":
            if row.tipo_fecha not in TIPO_CODES:
                raise BuildError(f"id {row_id}: tipo_fecha desconocido {row.tipo_fecha!r}")
            ev["t"] = TIPO_CODES[row.tipo_fecha]

        start, end = to_int(row.inicio), to_int(row.fin)
        approx = row.aproximada == "sí"
        open_end = 0

        if row.revisar == UNDATED_REVIEW:
            if start is not None or end is not None:
                raise BuildError(f"id {row_id}: marcada «sin fecha» pero tiene inicio/fin")
            _add_common(ev, row, approx)
            undated.append(ev)
            continue

        if start is None and end is None:
            raise BuildError(f"id {row_id}: sin inicio ni fin y sin marca «sin fecha»")
        if start is None:
            # «-1560»: solo se conoce el final → punto en el final, sin comienzo.
            assert end is not None
            start = end
            approx = True
            open_end = 2
            note("Solo fecha de final («-1560»): punto en el final, aproximada, `x`=2", row_id)
        elif end is None:
            end = start
            if is_open_range(row.fecha_texto):
                open_end = 1
                note("Rango abierto («6 ka BP-»): `fin` = `inicio`, `x`=1", row_id)
            else:
                note("`fin` vacío rellenado con `inicio`", row_id)

        if row.revisar == INVERTED_REVIEW:
            if start <= end:
                raise BuildError(f"id {row_id}: marcada como invertida pero inicio ≤ fin")
            start, end = end, start
            note("Inicio posterior al fin: se intercambian `inicio` y `fin`", row_id)
        elif row.revisar in MINOR_REVIEW:
            approx = True
            note(f"Revisión menor («{row.revisar}»): marcada como aproximada", row_id)
        elif row.revisar != "":
            raise BuildError(f"id {row_id}: motivo de revisión desconocido {row.revisar!r}")

        ev["a"] = start
        if end != start:
            ev["b"] = end
        for key, col in (("ma", "mes_inicio"), ("da", "dia_inicio"), ("mb", "mes_fin"), ("db", "dia_fin")):
            value = to_int(getattr(row, col))
            if value is not None:
                ev[key] = value
        _add_common(ev, row, approx)
        if open_end:
            ev["x"] = open_end
        events.append(ev)

    events.sort(key=lambda e: (e["a"], e["id"]))  # type: ignore[index]
    undated.sort(key=lambda e: e["id"])  # type: ignore[index]

    validate(events, undated, sections)
    wiki = add_wikipedia(events, undated)

    generated = date.today().isoformat()
    header = {"version": 1, "generated": generated, "macros": MACROS, "sections": sections}
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sizes = {}
    for name, items in (("events.json", events), ("undated.json", undated)):
        text = json.dumps({**header, "events": items}, ensure_ascii=False, separators=(",", ":"))
        data = text.encode("utf-8")
        (OUT_DIR / name).write_bytes(data)
        sizes[name] = (len(data), len(gzip.compress(data, compresslevel=9)))

    write_report(rows_read, excluded, fixes, fixed_ids, events, undated, sections, sizes, generated)

    total = len(events) + len(undated) + sum(excluded.values())
    print(f"Leídas {rows_read} · eje {len(events)} · sin fecha {len(undated)} · "
          f"excluidas {sum(excluded.values())} · con Wikipedia {wiki} · "
          f"cuadra: {'sí' if total == rows_read else 'NO'}")
    if total != rows_read:
        raise BuildError("El recuento no cuadra")


def add_wikipedia(events: list[dict[str, object]], undated: list[dict[str, object]]) -> int:
    """Añade el campo «w» (artículo de Wikipedia, con «#sección» si la hay) a los elegidos."""
    if not WIKI_PATH.exists():
        return 0
    table = pd.read_csv(WIKI_PATH, encoding="utf-8", dtype=str, keep_default_na=False)
    by_id = {e["id"]: e for e in events + undated}
    for row in table.itertuples():
        ev = by_id.get(int(row.id))
        if ev is None:
            raise BuildError(f"wikipedia.csv: no existe el id {row.id}")
        fragment = getattr(row, "seccion_articulo", "")
        ev["w"] = row.articulo + (f"#{fragment}" if fragment else "")
    return len(table)


def _add_common(ev: dict[str, object], row: object, approx: bool) -> None:
    if approx:
        ev["ap"] = 1
    era = getattr(row, "era")
    if era != "":
        ev["e"] = era
    otras = getattr(row, "otras_fechas")
    if otras != "":
        ev["o"] = otras
    ev["p"] = int(getattr(row, "pagina"))


def validate(events: list[dict[str, object]], undated: list[dict[str, object]],
             sections: list[dict[str, object]]) -> None:
    ids = [e["id"] for e in events] + [e["id"] for e in undated]
    if len(ids) != len(set(ids)):
        dupes = [i for i, n in Counter(ids).items() if n > 1]
        raise BuildError(f"ids repetidos: {dupes[:10]}")
    for e in events:
        a = e["a"]
        b = e.get("b", a)
        assert isinstance(a, int) and isinstance(b, int)
        if a > b:
            raise BuildError(f"id {e['id']}: inicio {a} > fin {b}")
        # Con mes y día: el comienzo no puede ser posterior al final.
        start = (a, e.get("ma", 0), e.get("da", 0))
        end = (b, e.get("mb", 13), e.get("db", 32))
        if start > end:
            raise BuildError(f"id {e['id']}: comienzo {start} posterior al final {end}")
        if max(1, PRESENT_REF - a) < 1:
            raise BuildError(f"id {e['id']}: «ya» no válido")
    for s in sections:
        macro = s["macro"]
        if not isinstance(macro, int) or not 0 <= macro < len(MACROS):
            raise BuildError(f"Sección {s['name']!r} sin macrocategoría válida")


def write_report(rows_read: int, excluded: Counter[str], fixes: Counter[str],
                 fixed_ids: dict[str, list[int]], events: list[dict[str, object]],
                 undated: list[dict[str, object]], sections: list[dict[str, object]],
                 sizes: dict[str, tuple[int, int]], generated: str) -> None:
    n_excl = sum(excluded.values())
    total = len(events) + len(undated) + n_excl
    by_macro = Counter(sections[e["s"]]["macro"] for e in events)  # type: ignore[index]
    by_macro_undated = Counter(sections[e["s"]]["macro"] for e in undated)  # type: ignore[index]
    by_section = Counter(e["s"] for e in events)
    by_section_undated = Counter(e["s"] for e in undated)

    def fmt(n: int) -> str:
        return f"{n:,}".replace(",", ".")

    lines = [
        "# Informe de construcción de datos",
        "",
        f"Generado: {generated} · Fuente: `data/cronologia.csv`",
        "",
        "## Recuento",
        "",
        "| Concepto | Filas |",
        "| --- | ---: |",
        f"| Filas leídas | {fmt(rows_read)} |",
        f"| Exportadas al eje (`events.json`) | {fmt(len(events))} |",
        f"| Exportadas sin fecha (`undated.json`, solo buscador) | {fmt(len(undated))} |",
    ]
    for reason, n in excluded.most_common():
        lines.append(f"| Excluidas: {reason} | {fmt(n)} |")
    lines += [
        f"| **Suma** | **{fmt(total)}** |",
        "",
        f"Cuadra: **{'sí' if total == rows_read else 'NO'}** "
        f"({fmt(len(events))} + {fmt(len(undated))} + {fmt(n_excl)} = {fmt(total)}).",
        "",
        "## Correcciones aplicadas (filas exportadas)",
        "",
        "| Corrección | Filas | ids |",
        "| --- | ---: | --- |",
    ]
    for kind, n in sorted(fixes.items(), key=lambda kv: -kv[1]):
        ids = sorted(fixed_ids[kind])
        shown = ", ".join(str(i) for i in ids[:12]) + (" …" if len(ids) > 12 else "")
        lines.append(f"| {kind} | {n} | {shown} |")
    approx_total = sum(1 for e in events if e.get("ap") == 1)
    lines += [
        "",
        f"Eventos del eje marcados como aproximados (`ap`=1): {fmt(approx_total)}.",
        "",
        "Etiquetas de sección corregidas: «Contempt» → «Contemporánea», «Moerna» → «Moderna».",
        "",
        "## Por macrocategoría",
        "",
        "| # | Macrocategoría | Secciones | Eje | Sin fecha |",
        "| ---: | --- | ---: | ---: | ---: |",
    ]
    sec_per_macro = Counter(s["macro"] for s in sections)
    for i, name in enumerate(MACROS):
        lines.append(f"| {i} | {name} | {sec_per_macro[i]} | {fmt(by_macro[i])} | {by_macro_undated[i]} |")
    lines += [
        f"| | **Total** | **{len(sections)}** | **{fmt(len(events))}** | **{len(undated)}** |",
        "",
        "## Por sección",
        "",
        "| Sección (etiqueta) | Macrocategoría | Eje | Sin fecha |",
        "| --- | --- | ---: | ---: |",
    ]
    for i, s in sorted(enumerate(sections), key=lambda t: (t[1]["macro"], t[1]["label"])):  # type: ignore[arg-type, return-value]
        lines.append(f"| {s['label']} | {MACROS[s['macro']]} | {by_section[i]} | {by_section_undated[i]} |")  # type: ignore[index]
    points = sum(1 for e in events if "b" not in e)
    lines += [
        "",
        "## Forma de los datos del eje",
        "",
        f"- Puntos (`inicio` = `fin`): {fmt(points)} · Barras: {fmt(len(events) - points)}",
        f"- Rango: {fmt(events[0]['a'])} a {fmt(max(e.get('b', e['a']) for e in events))}",  # type: ignore[arg-type, type-var]
        "",
        "## Tamaño de los archivos",
        "",
        "| Archivo | Sin comprimir | gzip |",
        "| --- | ---: | ---: |",
    ]
    for name, (raw, gz) in sizes.items():
        lines.append(f"| `{name}` | {raw / 1024:,.0f} KB | {gz / 1024:,.0f} KB |".replace(",", "."))
    lines.append("")
    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    try:
        build()
    except BuildError as err:
        print(f"ERROR: {err}", file=sys.stderr)
        sys.exit(1)
