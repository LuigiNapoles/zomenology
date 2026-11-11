import { MACRO_COLORS } from './macros';
import { WHITE, contrast, hex, luminance, mix, toHex, type RGB } from './color';

/** Los 10 estilos por periodo y los dos neutros. */
export type PeriodId =
  | 'cosmos'
  | 'deep'
  | 'paleo'
  | 'neo'
  | 'ancient'
  | 'classic'
  | 'medieval'
  | 'modern'
  | 'c19'
  | 'c20';
export type ThemeId = PeriodId | 'neutral-light' | 'neutral-dark';
/** Elección del usuario en el selector de estilo. */
export type StyleChoice = 'period' | 'neutral-light' | 'neutral-dark';

export type TextureId =
  | 'stars'
  | 'strata'
  | 'limestone'
  | 'clay'
  | 'papyrus'
  | 'marble'
  | 'parchment'
  | 'engraving'
  | 'newsprint';

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
}

/** Los 10 periodos, en orden. Límites y paletas de docs/PROYECTO.md. */
export const PERIODS: readonly Theme[] = [
  {
    id: 'cosmos',
    name: 'Cosmos',
    from: -Infinity,
    bg: '#0B0E1A',
    surface: '#151A2E',
    ink: '#E6E9F5',
    accent: '#8AB4FF',
    titleFont: 'Space Grotesk',
    texture: 'stars',
  },
  {
    id: 'deep',
    name: 'Tierra profunda',
    from: -4_540_000_000,
    bg: '#2B211B',
    surface: '#3A2D24',
    ink: '#F1E6D8',
    accent: '#D9822B',
    titleFont: 'Fraunces',
    texture: 'strata',
  },
  {
    id: 'paleo',
    name: 'Paleolítico',
    from: -2_580_000,
    bg: '#E9DCC6',
    surface: '#F3EADB',
    ink: '#2A1E16',
    accent: '#A8432A',
    titleFont: 'Caveat Brush',
    texture: 'limestone',
  },
  {
    id: 'neo',
    name: 'Neolítico',
    from: -9700,
    bg: '#EADBC4',
    surface: '#F5ECDD',
    ink: '#3B2A1E',
    accent: '#8C5A2B',
    titleFont: 'Josefin Slab',
    texture: 'clay',
  },
  {
    id: 'ancient',
    name: 'Antigüedad',
    from: -3300,
    bg: '#EFE3C2',
    surface: '#F7EED6',
    ink: '#2B2416',
    accent: '#1F6F8B',
    titleFont: 'Marcellus',
    texture: 'papyrus',
    ornament: '#C8A04A',
  },
  {
    id: 'classic',
    name: 'Mundo clásico',
    from: -800,
    bg: '#F4F1EA',
    surface: '#FFFFFF',
    ink: '#1E1E1E',
    accent: '#9E2B25',
    titleFont: 'Cinzel',
    texture: 'marble',
  },
  {
    id: 'medieval',
    name: 'Edad Media',
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
  },
  {
    id: 'modern',
    name: 'Edad Moderna',
    from: 1492,
    bg: '#F3EEE3',
    surface: '#FBF8F1',
    ink: '#1D1B18',
    accent: '#2E5B4E',
    titleFont: 'IM Fell English',
    texture: 'engraving',
  },
  {
    id: 'c19',
    name: 'Siglo XIX',
    from: 1789,
    bg: '#F2EFE8',
    surface: '#FFFFFF',
    ink: '#111111',
    accent: '#B22222',
    titleFont: 'Playfair Display',
    texture: 'newsprint',
  },
  {
    id: 'c20',
    name: 'Siglos XX–XXI',
    from: 1914,
    bg: '#FAFAF7',
    surface: '#FFFFFF',
    ink: '#111418',
    accent: '#E4572E',
    titleFont: 'Archivo',
    texture: null,
  },
];

const C20 = PERIODS[PERIODS.length - 1] as Theme;

/** Estilos neutros: la paleta de los siglos XX–XXI y su versión oscura, sin adornos. */
export const NEUTRAL_THEMES: readonly Theme[] = [
  { ...C20, id: 'neutral-light', name: 'Neutro claro' },
  {
    ...C20,
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
  return ALL_THEMES.find((t) => t.id === id) ?? C20;
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
