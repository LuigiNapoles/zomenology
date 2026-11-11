import { describe, expect, it } from 'vitest';
import { contrast, hex, mix, parseColor, toHex } from '../src/themes/color';
import {
  ALL_THEMES,
  PERIODS,
  activeTheme,
  buildThemeCSS,
  derivedColors,
  macroPalette,
  periodAt,
} from '../src/themes/periods';

const AA = 4.5;

describe('color', () => {
  it('lee y escribe colores', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255]);
    expect(parseColor('#0B0E1A')).toEqual([11, 14, 26]);
    expect(parseColor('rgb(1, 2, 3)')).toEqual([1, 2, 3]);
    expect(parseColor('rgba(1 2 3 / 0.5)')).toEqual([1, 2, 3]);
    expect(parseColor('azul')).toBeNull();
    expect(toHex([255, 0, 16])).toBe('#ff0010');
  });

  it('contraste WCAG: negro sobre blanco es 21:1', () => {
    expect(contrast(hex('#000'), hex('#fff'))).toBeCloseTo(21, 5);
    expect(contrast(hex('#777'), hex('#fff'))).toBeCloseTo(4.48, 2);
    expect(mix(hex('#000'), hex('#fff'), 0.5)).toEqual([127.5, 127.5, 127.5]);
  });
});

describe('periodos', () => {
  it('cada era se activa al cruzar su límite', () => {
    const cases: [number, string][] = [
      [-13_800_000_000, 'prehistory'],
      [-3301, 'prehistory'],
      [-3300, 'antiquity'],
      [475.9, 'antiquity'],
      [476, 'medieval'],
      [1788.9, 'medieval'],
      [1789, 'contemporary'],
      [2026, 'contemporary'],
    ];
    for (const [t, id] of cases) expect(periodAt(t).id, `año ${t}`).toBe(id);
    expect(PERIODS).toHaveLength(4);
  });

  it('el selector elige el neutro o el del periodo', () => {
    expect(activeTheme('period', 1250).id).toBe('medieval');
    expect(activeTheme('period', -4e9).id).toBe('prehistory');
    expect(activeTheme('neutral-light', 1250).id).toBe('neutral-light');
    expect(activeTheme('neutral-dark', -4e9).id).toBe('neutral-dark');
  });

  it('genera un bloque :root[data-period] por estilo', () => {
    const css = buildThemeCSS();
    for (const t of ALL_THEMES) expect(css).toContain(`:root[data-period='${t.id}']`);
  });
});

describe('contraste AA (4,5:1) en todos los estilos', () => {
  for (const theme of ALL_THEMES) {
    it(theme.name, () => {
      const c = derivedColors(theme);
      const pairs: [string, keyof typeof c, keyof typeof c][] = [
        ['tinta / fondo', '--ink', '--bg'],
        ['tinta / superficie', '--ink', '--surface'],
        ['tinta / carril alterno', '--ink', '--lane-alt'],
        ['tinta / hover', '--ink', '--hover'],
        ['secundario / fondo', '--muted', '--bg'],
        ['secundario / superficie', '--muted', '--surface'],
        ['secundario / carril alterno', '--muted', '--lane-alt'],
        ['acento en texto / fondo', '--accent-text', '--bg'],
        ['acento en texto / superficie', '--accent-text', '--surface'],
        ['fondo / tinta (botón activo)', '--bg', '--ink'],
        ['error / superficie', '--danger', '--surface'],
      ];
      for (const [name, fg, bg] of pairs) {
        const ratio = contrast(
          c[fg] as [number, number, number],
          c[bg] as [number, number, number],
        );
        expect(ratio, `${theme.name}: ${name} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(AA);
      }
      // Etiquetas dentro de las barras de las 12 macrocategorías.
      const { fill } = macroPalette(c['--bg'] as never, c['--surface'] as never);
      fill.forEach((f, i) => {
        const ratio = contrast(c['--ink'] as never, f);
        expect(
          ratio,
          `${theme.name}: tinta / barra ${i} = ${ratio.toFixed(2)}`,
        ).toBeGreaterThanOrEqual(AA);
      });
      // Adorno en texto (capitular medieval en ultramar).
      if (theme.ornament2) {
        const ratio = contrast(hex(theme.ornament2), c['--surface'] as never);
        expect(ratio, `${theme.name}: capitular`).toBeGreaterThanOrEqual(AA);
      }
    });
  }
});
