import { describe, expect, it } from 'vitest';
import {
  JUMPS,
  MIN_WINDOW_PX,
  jumpView,
  minimapTime,
  minimapX,
  viewCenteredAt,
  windowRect,
} from '../src/timeline/minimap';
import { centerTime, fullView, viewAround, visibleYears } from '../src/timeline/scale';
import { periodAt } from '../src/themes/periods';

const W = 1000;

describe('minimapa', () => {
  it('va del Big Bang (izquierda) a hoy (derecha) y es reversible', () => {
    expect(minimapX(-13_800_000_000, W)).toBeCloseTo(0, 6);
    expect(minimapX(2026, W)).toBeCloseTo(W, 6);
    let prev = -1;
    for (const t of [-13e9, -4e9, -1e6, -10_000, -500, 1, 1500, 1900, 2020]) {
      const x = minimapX(t, W);
      expect(x).toBeGreaterThan(prev);
      prev = x;
      expect(minimapTime(x, W)).toBeCloseTo(t, 3);
    }
  });

  it('todas las eras se ven: la Edad Media ocupa un tramo apreciable', () => {
    expect(minimapX(1492, W) - minimapX(476, W)).toBeGreaterThan(30);
  });

  it('el recuadro marca la ventana visible, con un ancho mínimo', () => {
    const full = windowRect(fullView('log'), 1200, W);
    expect(full.x0).toBeLessThanOrEqual(1);
    expect(full.x1).toBeGreaterThanOrEqual(W - 1);
    const tiny = windowRect(viewAround(1851.5, 0.2, 'linear'), 1200, W);
    expect(tiny.x1 - tiny.x0).toBeCloseTo(MIN_WINDOW_PX, 6);
    const mid = (tiny.x0 + tiny.x1) / 2;
    expect(mid).toBeCloseTo(minimapX(1851.5, W), 0);
  });

  it('arrastrar mantiene el zoom y mueve el centro', () => {
    for (const mode of ['linear', 'log'] as const) {
      const v = viewAround(1500, 100, mode);
      const moved = viewCenteredAt(v, 1700);
      expect(centerTime(moved)).toBeCloseTo(1700, 3);
      expect(moved.span).toBe(v.span);
    }
  });

  it('cada salto rápido cae en su época', () => {
    const expected: Record<string, string> = {
      'Edad Media': 'medieval',
      Moderna: 'medieval',
      Contemporánea: 'contemporary',
      Hoy: 'contemporary',
      Antigüedad: 'antiquity',
      Clásica: 'antiquity',
      Neolítico: 'prehistory',
      Paleolítico: 'prehistory',
    };
    for (const jump of JUMPS) {
      for (const mode of ['linear', 'log'] as const) {
        const v = jumpView(jump, mode);
        const c = centerTime(v);
        expect(Number.isFinite(c)).toBe(true);
        expect(visibleYears(v)).toBeGreaterThan(0);
        const era = expected[jump.label];
        if (era) expect(periodAt(c).id, `${jump.label} (${mode})`).toBe(era);
      }
    }
    expect(JUMPS.map((j) => j.label)).toEqual([
      'Big Bang',
      'Tierra',
      'Paleolítico',
      'Neolítico',
      'Antigüedad',
      'Clásica',
      'Edad Media',
      'Moderna',
      'Contemporánea',
      'Hoy',
    ]);
  });
});
