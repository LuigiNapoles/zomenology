import { describe, expect, it } from 'vitest';
import type { TimelineEvent } from '../src/data/types';
import { daysInMonth, endOf, eventSpan, startOf } from '../src/timeline/time';

const base: TimelineEvent = { id: 1, s: 0, d: 'x', p: 1 };

describe('tiempo continuo', () => {
  it('coloca meses y días', () => {
    expect(startOf(1851, 7)).toBeCloseTo(1851.5);
    expect(endOf(1851, 7)).toBeCloseTo(1851 + 7 / 12);
    expect(startOf(1282, 3, 30)).toBeCloseTo(1282 + 2 / 12 + 29 / (12 * 31));
    expect(endOf(1851)).toBe(1852);
  });

  it('días por mes con bisiestos', () => {
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2024, 4)).toBe(30);
  });

  it('distingue puntos y periodos', () => {
    expect(eventSpan({ ...base, a: 1851, ma: 7, mb: 7 })).toMatchObject({ point: true });
    expect(eventSpan({ ...base, a: 1851 })).toEqual({ start: 1851, end: 1852, point: true });
    expect(eventSpan({ ...base, a: 1880, b: 1890 })).toEqual({
      start: 1880,
      end: 1891,
      point: false,
    });
    expect(eventSpan({ ...base, a: 1282, ma: 3, da: 30, mb: 5, db: 22 }).point).toBe(false);
  });

  it('los a.C. van sin año 0', () => {
    expect(eventSpan({ ...base, a: -1 })).toEqual({ start: -1, end: 0, point: true });
  });
});
