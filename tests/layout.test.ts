import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DataFile } from '../src/data/types';
import { MIN_SEPARATION } from '../src/timeline/cluster';
import {
  INSIDE_PAD,
  LANE_PADDING,
  MAX_ROWS,
  ROW_HEIGHT,
  placeLane,
  type LaneLayout,
} from '../src/timeline/layout';
import { prepareEvents } from '../src/timeline/prepare';
import { fullView, viewAround, type ScaleMode, type View } from '../src/timeline/scale';
import { ICON_WIDTH, buildLayout, eventCoords, markerExtent } from '../src/timeline/viewLayout';

const data = JSON.parse(
  readFileSync(resolve(__dirname, '../public/data/events.json'), 'utf8'),
) as DataFile;
const prepared = prepareEvents(data);
const coords = { linear: eventCoords(prepared, 'linear'), log: eventCoords(prepared, 'log') };
// Ancho de etiqueta simulado: 7 px por carácter + icono si no es «evento».
const labelWidth = (i: number) =>
  (prepared.labels[i]?.length ?? 0) * 7 + (data.events[i]?.t !== 'e' ? ICON_WIDTH : 0);

const W = 1200;
const H = 700;

function views(): { name: string; view: View }[] {
  const out: { name: string; view: View }[] = [];
  for (const mode of ['linear', 'log'] as ScaleMode[]) {
    out.push({ name: `${mode} completa`, view: fullView(mode) });
    for (const [t, years] of [
      [-4_000_000_000, 2e9],
      [-1_000_000, 2e6],
      [-40_000, 50_000],
      [-4050, 5000],
      [-500, 2000],
      [1250, 300],
      [1492, 60],
      [1851.5, 3],
      [1851.5, 0.2],
      [2000, 40],
    ] as const) {
      out.push({ name: `${mode} ${t} ±${years}`, view: viewAround(t, years, mode) });
    }
  }
  return out;
}

function layoutFor(view: View, width = W, height = H) {
  return buildLayout(prepared, coords[view.mode], view, width, height, labelWidth);
}

function rowsOf(lane: LaneLayout) {
  const rows = new Map<number, { x0: number; x1: number; index: number }[]>();
  for (const item of lane.items) {
    const list = rows.get(item.row) ?? [];
    list.push(item);
    rows.set(item.row, list);
  }
  return rows;
}

describe('placeLane', () => {
  it('no solapa y manda a burbuja lo que no cabe', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      index: i,
      lane: 0,
      x0: 100 + i,
      x1: 108 + i,
      center: 104 + i,
      bar: false,
      labelWidth: 50,
    }));
    const { placed, overflow, rowsUsed } = placeLane(items, 3, -1000, 2000);
    expect(placed).toHaveLength(3);
    expect(overflow).toHaveLength(7);
    expect(rowsUsed).toBe(3);
    // El primero (más prioritario) lleva etiqueta.
    expect(placed[0]?.label).toBe('right');
  });

  it('pone la etiqueta dentro de una barra ancha', () => {
    const { placed } = placeLane(
      [{ index: 0, lane: 0, x0: 0, x1: 500, center: 250, bar: true, labelWidth: 100 }],
      1,
      0,
      1000,
    );
    expect(placed[0]?.label).toBe('inside');
    expect(placed[0]?.x1).toBe(500);
  });
});

describe('colocación con los datos reales', () => {
  for (const { name, view } of views()) {
    it(`sin solapes y sin perder eventos: ${name}`, () => {
      const layout = layoutFor(view);
      let shown = 0;
      let prevBottom = 0;
      for (const lane of layout.lanes) {
        // Carriles uno debajo de otro, sin solaparse.
        expect(lane.top).toBeGreaterThanOrEqual(prevBottom);
        prevBottom = lane.top + lane.height;
        const totalRows = lane.eventRows + (lane.bubbleRow >= 0 ? 1 : 0);
        expect(totalRows).toBeLessThanOrEqual(MAX_ROWS);
        expect(lane.height).toBe(totalRows * ROW_HEIGHT + 2 * LANE_PADDING);

        // Elementos de una misma fila (marcador + etiqueta) sin solaparse.
        for (const [row, list] of rowsOf(lane)) {
          expect(row).toBeLessThan(lane.eventRows);
          list.sort((a, b) => a.x0 - b.x0);
          for (let i = 1; i < list.length; i++) {
            const prev = list[i - 1];
            const cur = list[i];
            expect((cur?.x0 ?? 0) - (prev?.x1 ?? 0)).toBeGreaterThanOrEqual(MIN_SEPARATION);
          }
        }
        // Burbujas sin solaparse entre sí.
        for (let i = 1; i < lane.bubbles.length; i++) {
          const gap = (lane.bubbles[i]?.x0 ?? 0) - (lane.bubbles[i - 1]?.x1 ?? 0);
          expect(gap).toBeGreaterThanOrEqual(MIN_SEPARATION);
        }
        // Las etiquetas dentro de barra solo cuando caben en la parte visible de la ventana.
        for (const item of lane.items) {
          if (item.label === 'inside') {
            const visible = Math.min(item.x1, 1.5 * W) - Math.max(item.x0, -W / 2);
            expect(visible).toBeGreaterThanOrEqual(labelWidth(item.index) + 2 * INSIDE_PAD);
          }
        }
        shown += lane.items.length + lane.bubbles.reduce((s, b) => s + b.members.length, 0);
        // Si el carril tiene filas de eventos, la primera se usa.
        if (lane.eventRows > 0) {
          expect(lane.items.some((it) => it.row === 0)).toBe(true);
        }
      }
      // Cada evento de la ventana está colocado o dentro de una burbuja, una sola vez.
      const all = layout.lanes.flatMap((l) => [
        ...l.items.map((it) => it.index),
        ...l.bubbles.flatMap((b) => b.members),
      ]);
      expect(new Set(all).size).toBe(all.length);
      expect(shown).toBe(all.length);
      expect(shown).toBeGreaterThan(0);
      // Todo evento cuyo marcador se ve en pantalla está colocado o en una burbuja.
      const present = new Set(all);
      const left = view.center - view.span / 2;
      const k = W / view.span;
      for (let i = 0; i < prepared.count; i++) {
        const m = markerExtent(prepared, coords[view.mode], i, left, k);
        if (m.x1 >= 0 && m.x0 <= W) expect(present.has(i), `evento ${i}`).toBe(true);
      }
    });
  }

  it('los carriles caben en el alto disponible', () => {
    for (const { view } of views()) {
      const layout = layoutFor(view, W, 500);
      const bottom = layout.lanes.reduce((m, l) => Math.max(m, l.top + l.height), 0);
      expect(bottom).toBeLessThanOrEqual(
        Math.max(500, layout.lanes.length * (ROW_HEIGHT + 2 * LANE_PADDING)),
      );
    }
  });

  it('pliega los carriles sin eventos visibles', () => {
    // En el Big Bang solo hay eventos de «Tiempo profundo».
    const layout = layoutFor(viewAround(-13_750_000_000, 2e8, 'linear'));
    expect(layout.lanes.map((l) => l.lane)).toEqual([0]);
  });

  it('da etiqueta antes a los periodos más largos', () => {
    const layout = layoutFor(viewAround(1250, 300, 'linear'));
    for (const lane of layout.lanes) {
      const labelled = lane.items.filter((it) => it.label !== 'none');
      const unlabelled = lane.items.filter((it) => it.label === 'none');
      if (labelled.length === 0 || unlabelled.length === 0) continue;
      // El periodo más largo del carril tiene etiqueta.
      const longest = [...lane.items].sort(
        (a, b) =>
          (prepared.end[b.index] ?? 0) -
          (prepared.start[b.index] ?? 0) -
          ((prepared.end[a.index] ?? 0) - (prepared.start[a.index] ?? 0)),
      )[0];
      expect(longest?.label).not.toBe('none');
    }
  });
});
