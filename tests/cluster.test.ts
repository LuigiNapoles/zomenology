import { describe, expect, it } from 'vitest';
import {
  MIN_SEPARATION,
  bubbleLabel,
  bubbleWidth,
  clusterAction,
  clusterOverflow,
  type OverflowItem,
} from '../src/timeline/cluster';
import { MIN_TIME_SPAN, viewAround, visibleYears } from '../src/timeline/scale';

const W = 1200;

function point(index: number, center: number): OverflowItem {
  return { index, center, x0: center - 4, x1: center + 4, short: true };
}

describe('clusterOverflow', () => {
  it('agrupa los que caen en el mismo hueco de 24 px', () => {
    const bubbles = clusterOverflow([point(1, 100), point(2, 105), point(3, 110)], 24);
    expect(bubbles).toHaveLength(1);
    expect(bubbles[0]?.members).toEqual([1, 2, 3]);
    expect(bubbles[0]?.single).toBe(false);
    expect(bubbleLabel(42)).toBe('+42');
  });

  it('un evento suelto se pinta como su marcador', () => {
    const [bubble] = clusterOverflow([point(7, 300)], 24);
    expect(bubble?.single).toBe(true);
    expect(bubble?.x0).toBe(296);
  });

  it('funde las burbujas que se tocarían y nunca las solapa', () => {
    const items = Array.from({ length: 200 }, (_, i) => point(i, (i * 37) % 900));
    const bubbles = clusterOverflow(items, 24);
    for (let i = 1; i < bubbles.length; i++) {
      expect((bubbles[i]?.x0 ?? 0) - (bubbles[i - 1]?.x1 ?? 0)).toBeGreaterThanOrEqual(
        MIN_SEPARATION,
      );
    }
    const members = bubbles.flatMap((b) => b.members).sort((a, b) => a - b);
    expect(members).toEqual(items.map((it) => it.index));
  });

  it('ancho de burbuja según cifras', () => {
    expect(bubbleWidth(5)).toBeLessThan(bubbleWidth(50));
    expect(bubbleWidth(50)).toBeLessThan(bubbleWidth(500));
  });
});

describe('clusterAction', () => {
  it('acerca el zoom cuando los eventos se pueden separar', () => {
    const view = viewAround(1500, 1000, 'linear');
    const members = [
      { start: 1490, end: 1491 },
      { start: 1495, end: 1496 },
      { start: 1502, end: 1503 },
    ];
    const action = clusterAction(members, view, W);
    expect(action.kind).toBe('zoom');
    if (action.kind === 'zoom') {
      expect(visibleYears(action.view)).toBeLessThan(visibleYears(view));
    }
  });

  it('abre la lista si tienen la misma fecha y el zoom ya no puede separarlos', () => {
    const same = [
      { start: 1851, end: 1852 },
      { start: 1851, end: 1852 },
    ];
    expect(clusterAction(same, viewAround(1851.5, 3, 'linear'), W).kind).toBe('list');
    expect(clusterAction(same, viewAround(1851.5, MIN_TIME_SPAN, 'log'), W).kind).toBe('list');
  });

  it('funciona en modo logarítmico', () => {
    const view = viewAround(-50_000, 100_000, 'log');
    const action = clusterAction(
      [
        { start: -60_000, end: -59_000 },
        { start: -40_000, end: -39_000 },
      ],
      view,
      W,
    );
    expect(action.kind).toBe('zoom');
  });
});
