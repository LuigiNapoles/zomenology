import { MACRO_COLORS } from './macros';
import { WHITE, contrast, hex, luminance, mix, toHex, type RGB } from './color';

/**
 * Estilo único de la web (decisión del 11/11/2026): tonos crema cálidos, tipografía editorial
 * y tarjetas redondeadas, en modo claro u oscuro. Sustituye a los estilos por periodo.
 */
export type ThemeMode = 'light' | 'dark';

export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark'];

export interface Theme {
  id: ThemeMode;
  name: string;
  /** Fondo de la página. */
  bg: string;
  /** Fondo de la barra lateral. */
  sidebar: string;
  /** Tarjetas (eje, ficha, minimapa, ventanas). */
  surface: string;
  /** Texto principal. */
  ink: string;
  /** Terracota: botón principal, foco y detalles. */
  accent: string;
}

export const THEMES: Record<ThemeMode, Theme> = {
  light: {
    id: 'light',
    name: 'Claro',
    bg: '#FAF9F5',
    sidebar: '#F3F1EA',
    surface: '#FFFFFF',
    ink: '#1F1E1B',
    accent: '#B05730',
  },
  dark: {
    id: 'dark',
    name: 'Oscuro',
    bg: '#262624',
    sidebar: '#1F1E1D',
    surface: '#30302E',
    ink: '#F5F4EE',
    accent: '#D97757',
  },
};

/** Cuánto de oscuro es un fondo: 0 = claro, 1 = muy oscuro. */
export function darkness(bg: RGB): number {
  return Math.min(1, Math.max(0, (0.4 - luminance(bg)) / 0.4));
}

/**
 * Colores de macrocategoría para un fondo dado: en fondos oscuros se aclaran un 20 %.
 * Las barras se rellenan con una mezcla del color y la superficie, clara u oscura,
 * para que la etiqueta (color de tinta) se lea encima.
 */
export function macroPalette(bg: RGB, surface: RGB): { stroke: RGB[]; fill: RGB[] } {
  const d = darkness(bg);
  const stroke = MACRO_COLORS.map((c) => mix(WHITE, hex(c), 0.2 * d));
  const fill = stroke.map((c) => mix(c, surface, 0.28 + 0.07 * d));
  return { stroke, fill };
}

/** Variables CSS de un modo (las mismas fórmulas que usa la hoja de estilos y el eje). */
export function derivedColors(t: Theme): Record<string, RGB> {
  const bg = hex(t.bg);
  const surface = hex(t.surface);
  const sidebar = hex(t.sidebar);
  const ink = hex(t.ink);
  const accent = hex(t.accent);
  // Texto secundario: lo bastante suave para jerarquizar y con 4,5:1 sobre todos los fondos.
  const muted = mix(ink, surface, 0.7);
  // El acento solo se usa como texto si se lee (4,5:1) sobre fondo, barra y tarjetas.
  const accentReadable = [bg, surface, sidebar].every((c) => contrast(accent, c) >= 4.5);
  // Texto sobre el botón terracota: blanco o tinta oscura, el que más contraste dé.
  const onAccent =
    contrast(WHITE, accent) >= contrast(hex('#1F1E1B'), accent) ? WHITE : hex('#1F1E1B');
  return {
    '--bg': bg,
    '--sidebar': sidebar,
    '--surface': surface,
    '--ink': ink,
    '--muted': muted,
    '--accent': accent,
    '--on-accent': onAccent,
    '--accent-text': accentReadable ? accent : ink,
    '--line': mix(ink, surface, 0.14),
    '--line-strong': mix(ink, surface, 0.26),
    '--grid': mix(ink, surface, 0.08),
    '--lane-alt': mix(ink, surface, 0.03),
    '--hover': mix(ink, sidebar, 0.07),
    '--selected': mix(ink, sidebar, 0.11),
    '--soft': mix(ink, bg, 0.04),
    // Rojo de error: el oscuro si se lee sobre la superficie; si no, uno claro.
    '--danger': contrast(hex('#B3261E'), surface) >= 4.5 ? hex('#B3261E') : hex('#FF8A80'),
  };
}

/** Hoja de estilos con un bloque :root[data-theme="…"] por modo. */
export function buildThemeCSS(): string {
  return THEME_MODES.map((mode) => {
    const t = THEMES[mode];
    const vars = Object.entries(derivedColors(t))
      .map(([name, color]) => `  ${name}: ${toHex(color)};`)
      .join('\n');
    return `:root[data-theme='${mode}'] {\n${vars}\n  color-scheme: ${mode};\n}`;
  }).join('\n\n');
}
