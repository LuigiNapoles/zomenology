import { describe, expect, it } from 'vitest';
import { contrast, hex, mix, parseColor, toHex, type RGB } from '../src/themes/color';
import {
  THEMES,
  THEME_MODES,
  buildThemeCSS,
  derivedColors,
  macroPalette,
} from '../src/themes/theme';
import { ERAS, eraAt } from '../src/timeline/eras';

const AA = 4.5;

describe('color', () => {
  it('lee y escribe colores', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255]);
    expect(parseColor('rgb(1, 2, 3)')).toEqual([1, 2, 3]);
    expect(parseColor('azul')).toBeNull();
    expect(toHex([255, 0, 16])).toBe('#ff0010');
  });

  it('contraste WCAG: negro sobre blanco es 21:1', () => {
    expect(contrast(hex('#000'), hex('#fff'))).toBeCloseTo(21, 5);
    expect(mix(hex('#000'), hex('#fff'), 0.5)).toEqual([127.5, 127.5, 127.5]);
  });
});

describe('eras (solo informativas)', () => {
  it('cada era empieza en su límite', () => {
    const cases: [number, string][] = [
      [-13_800_000_000, 'prehistory'],
      [-3301, 'prehistory'],
      [-3300, 'antiquity'],
      [476, 'medieval'],
      [1789, 'contemporary'],
      [2026, 'contemporary'],
    ];
    for (const [t, id] of cases) expect(eraAt(t).id, `año ${t}`).toBe(id);
    expect(ERAS).toHaveLength(4);
  });
});

describe('modos claro y oscuro', () => {
  it('genera un bloque :root[data-theme] por modo', () => {
    const css = buildThemeCSS();
    for (const mode of THEME_MODES) expect(css).toContain(`:root[data-theme='${mode}']`);
  });

  for (const mode of THEME_MODES) {
    it(`contraste AA en el modo ${THEMES[mode].name.toLowerCase()}`, () => {
      const c = derivedColors(THEMES[mode]) as Record<string, RGB>;
      const pairs: [string, string][] = [
        ['--ink', '--bg'],
        ['--ink', '--surface'],
        ['--ink', '--sidebar'],
        ['--ink', '--hover'],
        ['--ink', '--selected'],
        ['--ink', '--lane-alt'],
        ['--muted', '--bg'],
        ['--muted', '--surface'],
        ['--muted', '--sidebar'],
        ['--accent-text', '--bg'],
        ['--accent-text', '--surface'],
        ['--on-accent', '--accent'],
        ['--danger', '--surface'],
      ];
      for (const [fg, bg] of pairs) {
        const ratio = contrast(c[fg] as RGB, c[bg] as RGB);
        expect(ratio, `${mode}: ${fg} / ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(AA);
      }
      const { fill } = macroPalette(c['--surface'] as RGB, c['--surface'] as RGB);
      fill.forEach((f, i) => {
        const ratio = contrast(c['--ink'] as RGB, f);
        expect(ratio, `${mode}: tinta / barra ${i}`).toBeGreaterThanOrEqual(AA);
      });
    });
  }
});
