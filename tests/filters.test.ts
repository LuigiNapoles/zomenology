import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DataFile } from '../src/data/types';
import {
  DEFAULT_FILTERS,
  compileFilter,
  countVisible,
  isDefaultFilters,
  rangeBounds,
  sanitizeFilters,
} from '../src/state/filters';
import { eventHash, loadSaved, parseEventHash, save } from '../src/state/persist';
import { prepareEvents } from '../src/timeline/prepare';
import { viewAround } from '../src/timeline/scale';

const file = JSON.parse(
  readFileSync(resolve(__dirname, '../public/data/events.json'), 'utf8'),
) as DataFile;
const data = prepareEvents(file);

describe('filtros', () => {
  it('sin filtros se ven todos', () => {
    expect(isDefaultFilters(DEFAULT_FILTERS)).toBe(true);
    expect(compileFilter(DEFAULT_FILTERS, data)).toBeNull();
    expect(countVisible(null, data)).toBe(data.count);
  });

  it('ocultar una macrocategoría quita sus secciones', () => {
    const medieval = file.sections.flatMap((s, i) => (s.macro === 6 ? [i] : []));
    const filter = compileFilter({ ...DEFAULT_FILTERS, hiddenSections: medieval }, data);
    const n = countVisible(filter, data);
    const medievalCount = file.events.filter((e) => medieval.includes(e.s)).length;
    expect(n).toBe(data.count - medievalCount);
    expect(medievalCount).toBeGreaterThan(1000);
  });

  it('tipo de fecha y solo fechas exactas', () => {
    const noLives = compileFilter({ ...DEFAULT_FILTERS, hiddenTypes: ['v'] }, data);
    expect(countVisible(noLives, data)).toBe(file.events.filter((e) => e.t !== 'v').length);
    const exact = compileFilter({ ...DEFAULT_FILTERS, exactOnly: true }, data);
    expect(countVisible(exact, data)).toBe(file.events.filter((e) => e.ap !== 1).length);
  });

  it('rango temporal: se ven los eventos que se solapan con él', () => {
    const f = { ...DEFAULT_FILTERS, from: '1500', to: '1600' };
    const filter = compileFilter(f, data);
    expect(filter).not.toBeNull();
    for (let i = 0; i < data.count; i++) {
      const overlaps = (data.end[i] as number) > 1500 && (data.start[i] as number) < 1601;
      expect(filter?.(i), `evento ${i}`).toBe(overlaps);
    }
    const deep = compileFilter({ ...DEFAULT_FILTERS, to: '1 Ma' }, data);
    expect(countVisible(deep, data)).toBeGreaterThan(100);
    expect(countVisible(deep, data)).toBeLessThan(1000);
  });

  it('señala los rangos que no se entienden', () => {
    const r = rangeBounds({ ...DEFAULT_FILTERS, from: 'ayer', to: '500 a.C.' });
    expect(r.fromError).toBe(true);
    expect(r.toError).toBe(false);
    expect(r.to).toBe(-499);
  });

  it('sanea filtros guardados', () => {
    expect(sanitizeFilters(null)).toEqual(DEFAULT_FILTERS);
    expect(
      sanitizeFilters({ hiddenSections: [1, 'x', -2], hiddenTypes: ['v', 'z'], exactOnly: 1 }),
    ).toEqual({ ...DEFAULT_FILTERS, hiddenSections: [1], hiddenTypes: ['v'] });
  });
});

describe('enlaces y guardado', () => {
  it('lee y escribe #e42', () => {
    expect(parseEventHash('#e42')).toBe(42);
    expect(parseEventHash(eventHash(10_464))).toBe(10_464);
    for (const bad of ['', '#', '#e', '#42', '#e4x', '#f42'])
      expect(parseEventHash(bad)).toBeNull();
  });

  it('guarda y recupera vista y filtros', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => void memory.set(k, v),
    };
    const view = viewAround(1500, 100, 'linear');
    const filters = { ...DEFAULT_FILTERS, exactOnly: true, from: '1400' };
    save({ view, filters }, storage);
    const back = loadSaved(storage);
    expect(back.view).toEqual(view);
    expect(back.filters).toEqual(filters);
  });

  it('ignora datos guardados dañados', () => {
    const broken = { getItem: () => '{no es json' };
    expect(loadSaved(broken)).toEqual({ view: null, filters: null });
    const weird = { getItem: () => JSON.stringify({ view: { mode: 'x', center: 1, span: 1 } }) };
    expect(loadSaved(weird).view).toBeNull();
    expect(loadSaved(null)).toEqual({ view: null, filters: null });
  });
});
