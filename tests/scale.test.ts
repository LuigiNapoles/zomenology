import { describe, expect, it } from 'vitest';
import {
  T_MAX_LOG,
  T_MIN,
  centerTime,
  clampView,
  fromCoord,
  fullView,
  panBy,
  switchMode,
  timeAtX,
  toCoord,
  viewAround,
  visibleYears,
  xOf,
  zoomAt,
  type ScaleMode,
  type View,
} from '../src/timeline/scale';

const W = 1200;
const modes: ScaleMode[] = ['linear', 'log'];

describe('scale', () => {
  it('toCoord y fromCoord son inversas', () => {
    for (const mode of modes) {
      for (const t of [T_MIN, -4_600_000_000, -45_000, -3000, -1, 1, 1851.5, 2025.9]) {
        const back = fromCoord(toCoord(t, mode), mode);
        expect(Math.abs(back - t)).toBeLessThan(Math.max(1e-6, Math.abs(t) * 1e-12));
      }
    }
  });

  it('en logarítmico usa log10(2027 − año) con mínimo 1', () => {
    expect(toCoord(2026, 'log')).toBeCloseTo(0);
    expect(toCoord(2026.9, 'log')).toBeCloseTo(0);
    expect(toCoord(1027, 'log')).toBeCloseTo(-3);
    expect(toCoord(-13_800_000_000, 'log')).toBeCloseTo(-Math.log10(13_800_002_027));
  });

  it('la vista completa contiene todo el rango, con el pasado a la izquierda', () => {
    for (const mode of modes) {
      const v = fullView(mode);
      const xBig = xOf(T_MIN, v, W);
      const xNow = xOf(T_MAX_LOG, v, W);
      expect(xBig).toBeGreaterThan(0);
      expect(xBig).toBeLessThan(W * 0.05);
      expect(xNow).toBeGreaterThan(W * 0.95);
      expect(xNow).toBeLessThanOrEqual(W);
    }
  });

  it('el zoom mantiene fijo el punto bajo el cursor', () => {
    for (const mode of modes) {
      const v = viewAround(1500, 2000, mode);
      const anchor = 300;
      const before = timeAtX(anchor, v, W);
      const z = zoomAt(v, 3, anchor, W);
      expect(timeAtX(anchor, z, W)).toBeCloseTo(before, 6);
      expect(visibleYears(z)).toBeLessThan(visibleYears(v));
    }
  });

  it('el zoom se detiene en unos 2 meses, sin NaN ni saltos, en cualquier punto', () => {
    for (const mode of modes) {
      for (const t of [T_MIN + 1, -4_600_000_000, -45_000, -4050, 1851.5, 2025.5]) {
        let v: View = viewAround(t, 1e6, mode);
        const anchor = timeAtX(W / 2, v, W);
        let prevYears = visibleYears(v);
        for (let i = 0; i < 400; i++) {
          v = zoomAt(v, 1.25, W / 2, W);
          const years = visibleYears(v);
          expect(Number.isFinite(years)).toBe(true);
          expect(years).toBeLessThanOrEqual(prevYears * 1.000001);
          prevYears = years;
        }
        expect(prevYears).toBeGreaterThan(0.16);
        expect(prevYears).toBeLessThan(0.17);
        // El ancla no deriva más que el ancho visible.
        expect(Math.abs(timeAtX(W / 2, v, W) - anchor)).toBeLessThan(prevYears);
        // Dos días seguidos siguen separados en pantalla.
        const x1 = xOf(anchor, v, W);
        const x2 = xOf(anchor + 1 / 365, v, W);
        expect(x2 - x1).toBeGreaterThan(10);
      }
    }
  });

  it('no deja alejarse más allá de la vista completa', () => {
    for (const mode of modes) {
      const v = zoomAt(fullView(mode), 0.01, 100, W);
      expect(v).toEqual(fullView(mode));
    }
  });

  it('el desplazamiento no saca el centro del rango', () => {
    for (const mode of modes) {
      let v = viewAround(1851, 10, mode);
      v = panBy(v, 1e16, W);
      expect(centerTime(v)).toBeGreaterThan(T_MIN - 1);
      expect(centerTime(v)).toBeLessThan(T_MIN + 1);
      v = panBy(v, -1e19, W);
      expect(centerTime(v)).toBeLessThanOrEqual(2027);
      expect(centerTime(v)).toBeGreaterThan(2025);
    }
  });

  it('al cambiar de modo conserva la fecha del centro y la escala local', () => {
    for (const t of [-4050, 1851.5, -2_500_000]) {
      const lin = viewAround(t, 100, 'linear');
      const log = switchMode(lin, 'log');
      expect(centerTime(log)).toBeCloseTo(t, 3);
      expect(visibleYears(log)).toBeGreaterThan(95);
      expect(visibleYears(log)).toBeLessThan(105);
      const back = switchMode(log, 'linear');
      expect(centerTime(back)).toBeCloseTo(t, 3);
      expect(visibleYears(back)).toBeCloseTo(100, 6);
    }
  });

  it('clampView arregla vistas no válidas', () => {
    const v = clampView({ mode: 'linear', center: Number.NaN, span: -5 });
    expect(Number.isFinite(v.center)).toBe(true);
    expect(v.span).toBeGreaterThan(0);
  });
});
