import { MACRO_COLORS } from './macros';
import { WHITE, contrast, hex, luminance, mix, toHex, type RGB } from './color';

/**
 * Estilos por periodo: 4 grandes eras (decisión del 11/11/2026, para que el estilo cambie
 * menos veces), cada una con la paleta de uno de los 10 estilos de docs/PROYECTO.md.
 */
export type PeriodId = 'prehistory' | 'antiquity' | 'medieval' | 'contemporary';
export type ThemeId = PeriodId | 'neutral-light' | 'neutral-dark';
/** Elección del usuario en el selector de estilo. */
export type StyleChoice = 'period' | 'neutral-light' | 'neutral-dark';

export type TextureId = 'limestone' | 'papyrus' | 'parchment';

export interface Theme {
  id: ThemeId;
  name: string;
  /** Comienzo del periodo (año continuo); el primero empieza en −∞. */
  from: number;
  bg: string;
  surface: string;
  ink: string;
  accent: string;
  /** Tipografía de títulos. */
  titleFont: string;
  /** Otras tipografías del periodo (p. ej. la capitular medieval). */
  extraFonts?: string[];
  texture: TextureId | null;
  /** Colores de adorno (oro, ultramar…). */
  ornament?: string;
  ornament2?: string;
  /** Color de la era en el minimapa. */
  band: string;
}

/** Las 4 eras, en orden. */
export const PERIODS: readonly Theme[] = [
  {
    // Estilo «Paleolítico»: pintura rupestre.
    id: 'prehistory',
    name: 'Prehistoria',
    from: -Infinity,
    bg: '#E9DCC6',
    surface: '#F3EADB',
    ink: '#2A1E16',
    accent: '#A8432A',
    titleFont: 'Caveat Brush',
    texture: 'limestone',
    band: '#A8432A',
  },
  {
    // Estilo «Antigüedad»: papiro y lapislázuli.
    id: 'antiquity',
    name: 'Antigüedad',
    from: -3300,
    bg: '#EFE3C2',
    surface: '#F7EED6',
    ink: '#2B2416',
    accent: '#1F6F8B',
    titleFont: 'Marcellus',
    texture: 'papyrus',
    ornament: '#C8A04A',
    band: '#1F6F8B',
  },
  {
    // Estilo «Edad Media»: manuscrito iluminado.
    id: 'medieval',
    name: 'Edad Media y Moderna',
    from: 476,
    bg: '#F1E7D0',
    surface: '#F8F1E1',
    ink: '#2A1A12',
    accent: '#8B1E1E',
    titleFont: 'Cormorant Garamond',
    extraFonts: ['UnifrakturCook'],
    texture: 'parchment',
    ornament: '#B8902F',
    ornament2: '#1F3A7A',
    band: '#B8902F',
  },
  {
    // Estilo «Siglos XX–XXI»: museo moderno.
    id: 'contemporary',
    name: 'Edad Contemporánea',
    from: 1789,
    bg: '#FAFAF7',
    surface: '#FFFFFF',
    ink: '#111418',
    accent: '#E4572E',
    titleFont: 'Archivo',
    texture: null,
    band: '#5B6470',
  },
];

const MODERN = PERIODS[PERIODS.length - 1] as Theme;

/** Estilos neutros: la paleta de la Edad Contemporánea y su versión oscura, sin adornos. */
export const NEUTRAL_THEMES: readonly Theme[] = [
  { ...MODERN, id: 'neutral-light', name: 'Neutro claro' },
  {
    ...MODERN,
    id: 'neutral-dark',
    name: 'Neutro oscuro',
    bg: '#121418',
    surface: '#1B1F26',
    ink: '#E8EAED',
    accent: '#FF8A65',
  },
];

export const ALL_THEMES: readonly Theme[] = [...PERIODS, ...NEUTRAL_THEMES];

export function themeById(id: ThemeId): Theme {
  return ALL_THEMES.find((t) => t.id === id) ?? MODERN;
}

/** Periodo al que pertenece el instante t (el centro de la vista). */
export function periodAt(t: number): Theme {
  let current = PERIODS[0] as Theme;
  for (const p of PERIODS) {
    if (t >= p.from) current = p;
    else break;
  }
  return current;
}

/** Estilo activo según la elección del usuario y la fecha del centro. */
export function activeTheme(choice: StyleChoice, centerT: number): Theme {
  if (choice === 'period') return periodAt(centerT);
  return themeById(choice);
}

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

/** Variables derivadas de la paleta base (las mismas fórmulas que usa la hoja de estilos). */
export function derivedColors(t: Theme): Record<string, RGB> {
  const bg = hex(t.bg);
  const surface = hex(t.surface);
  const ink = hex(t.ink);
  const accent = hex(t.accent);
  const muted = mix(ink, bg, 0.78);
  // El acento solo se usa en texto si cumple 4,5:1 sobre fondo y superficie; si no, la tinta.
  const accentOk = contrast(accent, bg) >= 4.5 && contrast(accent, surface) >= 4.5;
  return {
    '--bg': bg,
    '--surface': surface,
    '--ink': ink,
    '--accent': accent,
    '--accent-text': accentOk ? accent : ink,
    '--muted': muted,
    '--line': mix(ink, surface, 0.2),
    '--grid': mix(ink, bg, 0.1),
    '--lane-alt': mix(ink, bg, 0.04),
    '--hover': mix(ink, surface, 0.07),
    '--ornament': t.ornament ? hex(t.ornament) : accent,
    '--ornament-2': t.ornament2 ? hex(t.ornament2) : ink,
    // Rojo de error: el oscuro si se lee sobre la superficie; si no, uno claro.
    '--danger': contrast(hex('#B3261E'), surface) >= 4.5 ? hex('#B3261E') : hex('#FF8A80'),
  };
}

/** Hoja de estilos con un bloque :root[data-period="…"] por estilo. */
export function buildThemeCSS(): string {
  return ALL_THEMES.map((t) => {
    const vars = Object.entries(derivedColors(t))
      .map(([name, color]) => `  ${name}: ${toHex(color)};`)
      .join('\n');
    const dark = darkness(hex(t.bg)) > 0.5;
    return `:root[data-period='${t.id}'] {\n${vars}\n  --title-font: '${t.titleFont}';\n  color-scheme: ${dark ? 'dark' : 'light'};\n}`;
  }).join('\n\n');
}
