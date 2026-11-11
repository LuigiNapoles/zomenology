import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DataFile, TimelineEvent } from '../src/data/types';
import { fullView, viewAround, xOf, type ScaleMode } from '../src/timeline/scale';
import { computeTicks } from '../src/timeline/ticks';
import { eventSpan } from '../src/timeline/time';

const data = JSON.parse(
  readFileSync(resolve(__dirname, '../public/data/events.json'), 'utf8'),
) as DataFile;

function byId(id: number): TimelineEvent {
  const e = data.events.find((ev) => ev.id === id);
  if (!e) throw new Error(`falta el evento ${id}`);
  return e;
}

const W = 1200;
const modes: ScaleMode[] = ['linear', 'log'];

/** Posición de `t` y marcas vecinas en una vista centrada en `t` con `years` años visibles. */
function around(t: number, mode: ScaleMode, years: number) {
  const view = viewAround(t, years, mode);
  const ticks = computeTicks(view, W);
  const x = xOf(t, view, W);
  const left = [...ticks].reverse().find((k) => k.t <= t);
  const right = ticks.find((k) => k.t > t);
  return { x, left, right, ticks };
}

describe('Big Bang, «6 ka BP» y «jul 1851» en su sitio', () => {
  for (const mode of modes) {
    it(`Big Bang en el borde izquierdo y sobre «13.800 Ma» (${mode})`, () => {
      const bigBang = byId(10464);
      expect(bigBang.d).toMatch(/^Big Bang/);
      const t = eventSpan(bigBang).start;
      const x = xOf(t, fullView(mode), W);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(W * 0.03);
      const near = around(t, mode, 1e9);
      const tick = near.ticks.find((k) => k.label === '13.800 Ma');
      expect(tick).toBeDefined();
      expect(Math.abs((tick?.x ?? 0) - near.x)).toBeLessThan(0.5);
    });

    it(`«6 ka BP» = −4050, justo antes de «4000 a.C.» (${mode})`, () => {
      const ev = byId(169);
      expect(ev.f).toBe('6 ka BP-');
      const t = eventSpan(ev).start;
      expect(t).toBe(-4050);
      const { x, left, right } = around(t, mode, 5000);
      expect(left?.label).toMatch(/^(5000|4500) a\.C\.$/);
      expect(right?.label).toBe('4000 a.C.');
      const frac = (x - (left?.x ?? 0)) / ((right?.x ?? 0) - (left?.x ?? 0));
      expect(frac).toBeGreaterThan(0.85);
      expect(frac).toBeLessThan(1);
    });

    it(`«07|1851» cae dentro de julio de 1851 (${mode})`, () => {
      const ev = byId(1);
      expect(ev.f).toBe('07|1851');
      const span = eventSpan(ev);
      const mid = (span.start + span.end) / 2;
      const { x, left, right } = around(mid, mode, 0.5);
      expect(left?.label).toBe('jul 1851');
      expect(right?.label).toBe('ago 1851');
      expect(x).toBeGreaterThan(left?.x ?? Infinity);
      expect(x).toBeLessThan(right?.x ?? -Infinity);
    });
  }
});
