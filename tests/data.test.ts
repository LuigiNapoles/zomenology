import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DataFile } from '../src/data/types';
import { eventSpan } from '../src/timeline/time';

const dir = resolve(__dirname, '../public/data');

function load(name: string): DataFile {
  const path = resolve(dir, name);
  if (!existsSync(path)) {
    throw new Error(`Falta ${name}: ejecuta «py scripts/build_data.py»`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as DataFile;
}

describe('datos generados', () => {
  const events = load('events.json');
  const undated = load('undated.json');

  it('no repite ningún id entre los dos archivos', () => {
    const ids = [...events.events, ...undated.events].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cumple inicio ≤ fin y está ordenado por inicio', () => {
    let prev = -Infinity;
    for (const e of events.events) {
      expect(e.a).toBeTypeOf('number');
      const a = e.a ?? NaN;
      expect(a).toBeLessThanOrEqual(e.b ?? a);
      expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
  });

  it('asigna macrocategoría a las 57 secciones', () => {
    expect(events.sections).toHaveLength(57);
    expect(events.macros).toHaveLength(12);
    for (const s of events.sections) {
      expect(s.macro).toBeGreaterThanOrEqual(0);
      expect(s.macro).toBeLessThan(events.macros.length);
    }
    for (const e of events.events) {
      expect(events.sections[e.s]).toBeDefined();
    }
  });

  it('no exporta campos vacíos', () => {
    for (const e of [...events.events, ...undated.events]) {
      for (const value of Object.values(e)) {
        expect(value === '' || value === null).toBe(false);
      }
      expect(e.d.length).toBeGreaterThan(0);
    }
  });

  it('ningún evento termina antes de empezar (con mes y día)', () => {
    for (const e of events.events) {
      const { start, end } = eventSpan(e);
      expect(end, `id ${e.id}`).toBeGreaterThan(start);
    }
  });

  it('deja los eventos sin fecha fuera del eje', () => {
    for (const e of undated.events) {
      expect(e.a).toBeUndefined();
    }
  });

  it('corrige solo las erratas de sección indicadas', () => {
    const labels = events.sections.map((s) => s.label);
    expect(labels.some((l) => l.startsWith('Contempt') || l.startsWith('Moerna'))).toBe(false);
    for (const s of events.sections) {
      const fixed = s.name.replace(/^Contempt /, 'Contemporánea ').replace(/^Moerna /, 'Moderna ');
      expect(s.label).toBe(fixed);
    }
  });
});
