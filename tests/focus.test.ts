import { describe, expect, it } from 'vitest';
import { viewForEvent } from '../src/timeline/focus';
import { centerTime, fullView, viewAround, visibleYears } from '../src/timeline/scale';

describe('viewForEvent', () => {
  it('encaja un periodo en el 60 % de la pantalla', () => {
    for (const mode of ['linear', 'log'] as const) {
      const v = viewForEvent(1880, 1891, false, fullView(mode));
      expect(centerTime(v)).toBeCloseTo(1885.5, 3);
      expect(visibleYears(v)).toBeGreaterThan(17);
      expect(visibleYears(v)).toBeLessThan(20);
    }
  });

  it('a un punto le da contexto sin cambiar un zoom ya cercano', () => {
    const near = viewAround(1500, 40, 'linear');
    expect(visibleYears(viewForEvent(1851, 1852, true, near))).toBeCloseTo(40, 6);
    const far = viewForEvent(1851, 1852, true, fullView('linear'));
    expect(visibleYears(far)).toBeLessThanOrEqual(90);
    expect(centerTime(far)).toBeCloseTo(1851.5, 3);
  });

  it('nunca baja de 2 meses', () => {
    const v = viewForEvent(1851.5, 1851.51, false, fullView('linear'));
    expect(visibleYears(v)).toBeGreaterThan(0.16);
  });
});
