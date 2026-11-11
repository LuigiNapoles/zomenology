import { describe, expect, it } from 'vitest';
import { MAX_TARGETS, pickTargets, type VisibleTarget } from '../src/timeline/renderer';
import { CharWidths, MARGIN, warmUp } from '../src/timeline/textWidth';

describe('anchos de etiqueta por letras (Fase 7)', () => {
  it('suma los anchos de cada letra, mide cada letra una sola vez y nunca se queda corto', () => {
    const calls: string[] = [];
    const widths = new CharWidths((ch) => {
      calls.push(ch);
      return ch === 'm' ? 12 : 6;
    });
    expect(widths.width('mamá')).toBe(Math.ceil((12 + 6 + 12 + 6) * MARGIN + 1));
    expect(widths.width('mamá')).toBeGreaterThanOrEqual(36);
    expect(calls).toEqual(['m', 'a', 'á']);
    widths.reset();
    widths.width('a');
    expect(calls).toEqual(['m', 'a', 'á', 'a']);
  });

  it('mide de antemano todas las letras, en tandas', async () => {
    let measured = 0;
    let pauses = 0;
    const widths = new CharWidths(() => {
      measured++;
      return 7;
    });
    const count = await warmUp(widths, ['Σπήλαιον', 'Φράγχθι', 'abc'], 4, async () => {
      pauses++;
    });
    expect(count).toBe(new Set('ΣπήλαιονΦράγχθιabc').size);
    expect(measured).toBe(count);
    expect(pauses).toBe(Math.floor(count / 4));
    // Lo ya medido no se vuelve a medir.
    expect(await warmUp(widths, ['abc'])).toBe(0);
  });
});

describe('lista accesible de eventos visibles (Fase 7)', () => {
  const target = (index: number, x: number, lane = 0): VisibleTarget => ({
    kind: 'event',
    index,
    x,
    lane,
  });

  it('ordena de izquierda a derecha y, a igual posición, por carril', () => {
    const list = pickTargets([target(1, 300, 2), target(2, 100), target(3, 300, 1)], 1000);
    expect(list.map((t) => t.kind === 'event' && t.index)).toEqual([2, 3, 1]);
  });

  it(`como mucho ${MAX_TARGETS}: se quedan los más cercanos al centro`, () => {
    const many = Array.from({ length: 500 }, (_, i) => target(i, i * 2));
    const list = pickTargets(many, 1000);
    expect(list.length).toBe(MAX_TARGETS);
    const xs = list.map((t) => t.x);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(300);
    expect(Math.max(...xs)).toBeLessThanOrEqual(700);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });
});
