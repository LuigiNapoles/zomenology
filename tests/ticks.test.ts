import { describe, expect, it } from 'vitest';
import { fullView, viewAround, type ScaleMode } from '../src/timeline/scale';
import { STEPS, computeTicks, type TickLevel } from '../src/timeline/ticks';

const W = 1200;
const modes: ScaleMode[] = ['linear', 'log'];

describe('pasos', () => {
  it('entre dos pasos seguidos hay como mucho un factor 2', () => {
    for (let i = 1; i < STEPS.length; i++) {
      const ratio = (STEPS[i]?.step ?? 0) / (STEPS[i - 1]?.step ?? 1);
      expect(ratio).toBeGreaterThan(1);
      expect(ratio).toBeLessThanOrEqual(2.0001);
    }
  });
});

describe('los 7 niveles de escala (lineal)', () => {
  const cases: [TickLevel, number, number, RegExp][] = [
    ['Ma', -4_000_000_000, 2e9, /^\d{1,3}(\.\d{3})* Ma$/],
    ['ka', -40_000, 150_000, /^\d+ ka$/],
    ['ka', -40_000, 30_000, /^\d+ ka$/],
    ['millennium', -3000, 20_000, /^(\d+(\.\d{3})* a\.C\.|año 1|\d+)$/],
    ['century', 1300, 2000, /^s\. [IVXLC]+$/],
    ['decade', 1850, 200, /^\d{4}$/],
    ['year', 1851, 30, /^\d{4}$/],
    ['month', 1851.5, 4, /^(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic) 18\d\d$/],
  ];
  for (const [level, t, years, re] of cases) {
    it(`${level}: etiquetas como ${re}`, () => {
      const ticks = computeTicks(viewAround(t, years, 'linear'), W);
      expect(ticks.length).toBeGreaterThanOrEqual(6);
      expect(ticks.length).toBeLessThanOrEqual(12);
      for (const tick of ticks) {
        expect(tick.level).toBe(level);
        expect(tick.label).toMatch(re);
      }
    });
  }

  it('ejemplos exactos del documento', () => {
    const labels = (t: number, years: number) =>
      computeTicks(viewAround(t, years, 'linear'), W).map((k) => k.label);
    expect(labels(-4_600_000_000, 2e9)).toContain('4.600 Ma');
    expect(labels(1950 - 45_000, 50_000)).toContain('45 ka');
    expect(labels(-6000, 20_000)).toContain('6000 a.C.');
    expect(labels(-3000, 10_000)).toContain('3000 a.C.');
    expect(labels(1250, 1000)).toContain('s. XIII');
    expect(labels(1851, 10)).toContain('1851');
    expect(labels(1851.5, 2)).toContain('jul 1851');
  });

  it('entre 6 y 12 marcas desde casi todo el rango hasta 6 meses', () => {
    for (let years = 1e10; years >= 0.5; years /= 1.37) {
      for (const t of [-1e9, -100_000, 1800]) {
        const count = computeTicks(viewAround(t, years, 'linear'), W).length;
        expect(count).toBeGreaterThanOrEqual(6);
        expect(count).toBeLessThanOrEqual(12);
      }
    }
  });

  it('antes del 1000 a.C. los siglos se escriben como años', () => {
    const labels = computeTicks(viewAround(-6000, 3000, 'linear'), W).map((k) => k.label);
    expect(labels.some((l) => l.startsWith('s. '))).toBe(false);
    expect(labels).toContain('6000 a.C.');
  });

  it('nunca pone una marca en el año 0', () => {
    for (const years of [3, 30, 300, 3000]) {
      const ticks = computeTicks(viewAround(0, years, 'linear'), W);
      expect(ticks.some((k) => k.t === 0)).toBe(false);
      expect(ticks.some((k) => k.t === 1)).toBe(true);
    }
  });

  it('no repite etiquetas', () => {
    for (const mode of modes) {
      for (const years of [1e10, 1e6, 1e4, 300, 3, 0.3]) {
        const ticks = computeTicks(viewAround(1000, years, mode), W);
        const labels = ticks.map((k) => k.label);
        expect(new Set(labels).size).toBe(labels.length);
      }
    }
  });
});

describe('modo logarítmico', () => {
  it('vista completa: marcas legibles, ordenadas y con hitos', () => {
    const ticks = computeTicks(fullView('log'), W);
    expect(ticks.length).toBeGreaterThanOrEqual(6);
    expect(ticks.length).toBeLessThanOrEqual(13);
    for (let i = 1; i < ticks.length; i++) {
      expect((ticks[i]?.x ?? 0) - (ticks[i - 1]?.x ?? 0)).toBeGreaterThanOrEqual(W / 12 - 1e-6);
    }
    const labels = ticks.map((k) => k.label);
    expect(labels).toContain('1 Ma');
    expect(labels).toContain('10 ka');
    expect(labels).toContain('1.000 Ma');
    // La mitad izquierda (tiempo profundo) también tiene marcas.
    expect(ticks.filter((k) => k.x < W / 2).length).toBeGreaterThanOrEqual(3);
    expect(ticks.filter((k) => k.milestone).length).toBeGreaterThanOrEqual(3);
    // Ma a la izquierda y fechas históricas a la derecha.
    expect(ticks[0]?.label).toMatch(/Ma$/);
    expect(ticks[ticks.length - 1]?.label).toMatch(/^\d{4}$/);
  });

  it('al acercar, todos los niveles siguen dando entre 2 y 13 marcas', () => {
    for (const t of [-4_600_000_000, -45_000, -3000, 1250, 1851.5]) {
      for (let years = 1e9; years >= 0.2; years /= 3) {
        const n = computeTicks(viewAround(t, years, 'log'), W).length;
        expect(n).toBeGreaterThanOrEqual(2);
        expect(n).toBeLessThanOrEqual(13);
      }
    }
  });
});
