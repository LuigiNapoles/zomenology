import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DataFile, Section, TimelineEvent } from '../src/data/types';
import {
  MAX_PER_GROUP,
  findContemporaries,
  intervalDistance,
  pointMargin,
} from '../src/features/contemporaries';
import {
  ORDER_SIZE,
  ROUND_SIZE,
  EMPTY_SCORE,
  addAnswer,
  bucketLabel,
  bucketOf,
  isChronological,
  loadBest,
  makeRound,
  questionEvents,
  quizPool,
  recordScore,
  stepBucket,
} from '../src/features/quiz';
import { randomEvent, shuffle } from '../src/features/random';
import { compileFilter, DEFAULT_FILTERS } from '../src/state/filters';
import { prepareEvents } from '../src/timeline/prepare';
import { T_MAX_LOG, travelView, type View } from '../src/timeline/scale';

/** Generador pseudoaleatorio con semilla (mulberry32), para tests repetibles. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SECTIONS: Section[] = [0, 1, 2, 3].map((macro) => ({
  name: `s${macro}`,
  label: `S${macro}`,
  macro,
}));

let nextId = 1;
function ev(
  macro: number,
  a: number,
  b?: number,
  extra: Partial<TimelineEvent> = {},
): TimelineEvent {
  return { id: nextId++, s: macro, d: `Evento ${nextId}`, f: String(a), a, b, p: 1, ...extra };
}

function prepared(events: TimelineEvent[]) {
  const sorted = [...events].sort((x, y) => (x.a ?? 0) - (y.a ?? 0));
  return prepareEvents({ events: sorted, sections: SECTIONS });
}

function realData(): DataFile {
  const path = resolve(__dirname, '../public/data/events.json');
  if (!existsSync(path)) throw new Error('Falta events.json: ejecuta «py scripts/build_data.py»');
  return JSON.parse(readFileSync(path, 'utf8')) as DataFile;
}

describe('¿Qué pasaba a la vez? (F11)', () => {
  it('evento puntual: ventana de ±10 años y solo otras macrocategorías', () => {
    const data = prepared([
      ev(0, 1250),
      ev(0, 1252), // misma macrocategoría
      ev(1, 1240),
      ev(1, 1260),
      ev(1, 1261), // fuera: la ventana llega hasta el final de 1260
      ev(2, 1239), // fuera
      ev(2, 1100, 1300), // periodo que lo contiene
    ]);
    const i = data.events.findIndex((e) => e.a === 1250);
    const r = findContemporaries(data, i);
    expect(r.margin).toBe(10);
    const years = r.groups.flatMap((g) => g.items.map((j) => data.events[j]?.a));
    expect(years.sort()).toEqual([1100, 1240, 1260]);
    expect(r.groups.map((g) => g.macro)).toEqual([1, 2]);
  });

  it('antes de −10.000 la ventana es ±10 % de la antigüedad', () => {
    expect(pointMargin(-1_000_000)).toBeCloseTo((T_MAX_LOG + 1_000_000) * 0.1, 6);
    expect(pointMargin(-9000)).toBe(10);
  });

  it('periodo: lo que se solapa con él', () => {
    const data = prepared([ev(0, 1200, 1250), ev(1, 1230), ev(1, 1251), ev(2, 1150, 1200)]);
    const i = data.events.findIndex((e) => e.b === 1250);
    const r = findContemporaries(data, i);
    expect(r.margin).toBe(0);
    const years = r.groups.flatMap((g) => g.items.map((j) => data.events[j]?.a));
    expect(years.sort()).toEqual([1150, 1230]);
  });

  it('ordena por cercanía, como mucho 5 por grupo, y respeta los filtros', () => {
    const others = [1, 9, 3, 7, 5, 2, 8].map((k) => ev(1, 1250 + k));
    const data = prepared([ev(0, 1250), ...others, ev(2, 1251)]);
    const i = data.events.findIndex((e) => e.a === 1250);
    const r = findContemporaries(data, i);
    const g1 = r.groups.find((g) => g.macro === 1);
    expect(g1?.total).toBe(7);
    expect(g1?.items.length).toBe(MAX_PER_GROUP);
    expect(g1?.items.map((j) => data.events[j]?.a)).toEqual([1251, 1252, 1253, 1255, 1257]);
    // Ocultar la macrocategoría 2 con los filtros.
    const filter = compileFilter({ ...DEFAULT_FILTERS, hiddenSections: [2] }, data);
    expect(findContemporaries(data, i, filter).groups.map((g) => g.macro)).toEqual([1]);
  });

  it('un periodo enorme no cuenta como «el más cercano»', () => {
    expect(intervalDistance(1250, 1251, 476, 1492)).toBeGreaterThan(
      intervalDistance(1250, 1251, 1258, 1259),
    );
  });

  it('criterio: los eventos del siglo XIII tienen contemporáneos de al menos 3 macrocategorías', () => {
    const data = prepareEvents(realData());
    const xiii: number[] = [];
    data.events.forEach((e, i) => {
      if ((e.a ?? 0) >= 1201 && (e.a ?? 0) <= 1300) xiii.push(i);
    });
    expect(xiii.length).toBeGreaterThan(50);
    const poor = xiii.filter((i) => findContemporaries(data, i).groups.length < 3);
    expect(poor.map((i) => data.events[i]?.id)).toEqual([]);
  });
});

describe('Sorpréndeme (F12)', () => {
  it('elige solo entre los visibles y evita repetir el abierto', () => {
    const rng = seeded(1);
    const even = (i: number) => i % 2 === 0;
    for (let k = 0; k < 200; k++) {
      const i = randomEvent(10, even, rng, 4);
      expect(i % 2).toBe(0);
      expect(i).not.toBe(4);
    }
    expect(randomEvent(10, () => false, rng)).toBe(-1);
    expect(randomEvent(1, null, rng, 0)).toBe(0);
  });

  it('el viaje empieza y acaba en su sitio y a mitad de camino se ven los dos extremos', () => {
    const from: View = { mode: 'linear', center: 1900, span: 50 };
    const to: View = { mode: 'linear', center: -3000, span: 400 };
    const begin = travelView(from, to, 0);
    expect(begin.center).toBeCloseTo(from.center, 6);
    expect(begin.span).toBeCloseTo(from.span, 6);
    const end = travelView(from, to, 1);
    expect(end.center).toBeCloseTo(to.center, 6);
    expect(end.span).toBeCloseTo(to.span, 6);
    const mid = travelView(from, to, 0.5);
    expect(mid.span).toBeGreaterThanOrEqual(Math.abs(to.center - from.center));
    // Si el destino está cerca, no hace falta alejarse.
    const near = travelView(from, { ...from, center: 1910 }, 0.5);
    expect(near.span).toBeCloseTo(50, 6);
  });

  it('barajar no pierde ni repite elementos', () => {
    const out = shuffle([1, 2, 3, 4, 5, 6], seeded(3));
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('Quiz (F13)', () => {
  it('siglos y milenios, sin año 0', () => {
    expect(bucketOf(1215)).toEqual({ unit: 'century', n: 13 });
    expect(bucketOf(1200)).toEqual({ unit: 'century', n: 12 });
    expect(bucketOf(-1)).toEqual({ unit: 'century', n: -1 });
    expect(bucketOf(-100)).toEqual({ unit: 'century', n: -1 });
    expect(bucketOf(-101)).toEqual({ unit: 'century', n: -2 });
    expect(bucketOf(-1000)).toEqual({ unit: 'century', n: -10 });
    expect(bucketOf(-1001)).toEqual({ unit: 'millennium', n: -2 });
    expect(bucketOf(-5500)).toEqual({ unit: 'millennium', n: -6 });
    expect(bucketLabel({ unit: 'century', n: 13 })).toBe('s. XIII');
    expect(bucketLabel({ unit: 'century', n: -5 })).toBe('s. V a.C.');
    expect(bucketLabel({ unit: 'millennium', n: -3 })).toBe('III milenio a.C.');
    expect(stepBucket({ unit: 'century', n: -1 }, 1)).toEqual({ unit: 'century', n: 1 });
    expect(stepBucket({ unit: 'century', n: 1 }, -2)).toEqual({ unit: 'century', n: -2 });
  });

  it('solo usa eventos con fecha exacta, del periodo elegido', () => {
    const data = prepared([
      ev(0, 1250),
      ev(0, 1251, undefined, { ap: 1 }), // aproximada
      ev(0, 1252, undefined, { x: 1 }), // sin final conocido
      ev(0, 1290, 1310), // cruza de siglo
      ev(0, -500),
      ev(0, -20_000),
    ]);
    const years = (pool: number[]) => pool.map((i) => data.events[i]?.a);
    expect(years(quizPool(data, 'order', 'all'))).toEqual([-20_000, -500, 1250, 1290]);
    expect(years(quizPool(data, 'century', 'all'))).toEqual([-500, 1250]);
    expect(years(quizPool(data, 'order', 'medieval'))).toEqual([1250, 1290]);
    expect(years(quizPool(data, 'order', 'prehistory'))).toEqual([-20_000]);
  });

  it('criterio: una ronda no repite eventos (Ordena y ¿Qué siglo?)', () => {
    const data = prepareEvents(realData());
    for (const mode of ['order', 'century'] as const) {
      for (const era of ['all', 'prehistory', 'antiquity', 'medieval', 'contemporary'] as const) {
        const pool = quizPool(data, mode, era);
        for (let seed = 1; seed <= 5; seed++) {
          const round = makeRound(mode, pool, data, seeded(seed));
          expect(round, `${mode} ${era}`).not.toBeNull();
          if (!round) continue;
          expect(round.length).toBe(ROUND_SIZE);
          const ids = round.flatMap(questionEvents);
          expect(new Set(ids).size, `${mode} ${era} semilla ${seed}`).toBe(ids.length);
          for (const q of round) {
            if (q.kind === 'order') {
              expect(q.items.length).toBe(ORDER_SIZE);
              expect(new Set(q.items.map((i) => data.events[i]?.a)).size).toBe(ORDER_SIZE);
              expect(isChronological(q.items, data)).toBe(false);
              for (const i of q.items) expect(data.approx[i]).toBe(0);
            } else {
              const labels = q.options.map(bucketLabel);
              expect(new Set(labels).size).toBe(4);
              const e = data.events[q.event];
              expect(labels[q.answer]).toBe(bucketLabel(bucketOf(e?.a ?? 0)));
              for (const b of q.options) {
                expect(b.n).not.toBe(0);
                expect(b.unit).toBe(q.options[0]?.unit);
                if (b.unit === 'century') expect(b.n).toBeLessThanOrEqual(21);
              }
            }
          }
        }
      }
    }
  });

  it('sin eventos suficientes no hay ronda', () => {
    const data = prepared([ev(0, 1250), ev(0, 1260), ev(0, 1270), ev(0, 1280), ev(0, 1290)]);
    expect(makeRound('order', quizPool(data, 'order', 'all'), data, seeded(1))).toBeNull();
    expect(makeRound('century', quizPool(data, 'century', 'all'), data, seeded(1))).toBeNull();
  });

  it('marcador y racha', () => {
    let s = EMPTY_SCORE;
    for (const right of [true, true, false, true, true, true, false]) s = addAnswer(s, right);
    expect(s).toEqual({ correct: 5, streak: 0, bestStreak: 3 });
  });

  it('criterio: guarda la mejor puntuación de cada modo', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => void memory.set(k, v),
    };
    expect(loadBest(storage)).toEqual({ order: 0, century: 0 });
    expect(recordScore('order', 6, storage)).toEqual({ best: 6, record: true });
    expect(recordScore('order', 4, storage)).toEqual({ best: 6, record: false });
    expect(recordScore('century', 9, storage)).toEqual({ best: 9, record: true });
    expect(loadBest(storage)).toEqual({ order: 6, century: 9 });
    memory.set('cronologia:quiz:v1', '{"order": "x", "century": 99');
    expect(loadBest(storage)).toEqual({ order: 0, century: 0 });
  });
});
