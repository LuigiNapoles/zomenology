/**
 * Colores fijos de las 12 macrocategorías (Okabe-Ito ampliada con tonos de Paul Tol),
 * distinguibles entre sí y para daltonismo. No cambian con el estilo de periodo.
 */
export const MACRO_COLORS: readonly string[] = [
  '#332288', // 0 Tiempo profundo — índigo
  '#882255', // 1 Paleolítico — vino
  '#E69F00', // 2 Neolítico — naranja
  '#D55E00', // 3 Próximo Oriente antiguo — bermellón
  '#B8A100', // 4 Antigüedad — amarillo oscurecido
  '#CC79A7', // 5 Mundo clásico — rosa púrpura
  '#0072B2', // 6 Edad Media — azul
  '#009E73', // 7 Edad Moderna — verde azulado
  '#56B4E9', // 8 Edad Contemporánea — azul cielo
  '#117733', // 9 Mundo extraeuropeo — verde
  '#44AA99', // 10 Geografía — turquesa
  '#777777', // 11 Temas — gris
];

/** Nombres cortos de las macrocategorías para la columna de carriles en móvil (< 768 px). */
export const MACRO_SHORT: readonly string[] = [
  'Profundo',
  'Paleolít.',
  'Neolítico',
  'P. Oriente',
  'Antigüed.',
  'Clásico',
  'Medieval',
  'Moderna',
  'Contemp.',
  'Extraeur.',
  'Geografía',
  'Temas',
];

function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mezcla el color con blanco: `amount` = 0 deja el color, 1 da blanco. */
export function tint(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export function macroColor(macro: number): string {
  return MACRO_COLORS[macro] ?? '#777777';
}
