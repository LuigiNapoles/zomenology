/** Utilidades de color: lectura, mezcla y contraste WCAG. */

export type RGB = [number, number, number];

/** Lee «#rgb», «#rrggbb», «rgb(r, g, b)» o «rgba(r, g, b, a)» (se ignora la transparencia). */
export function parseColor(text: string): RGB | null {
  const s = text.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    let h = hex[1] ?? '';
    if (h.length === 3) h = h.replace(/./g, (c) => c + c);
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

export function toHex([r, g, b]: RGB): string {
  const h = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function toCss([r, g, b]: RGB, alpha = 1): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  return alpha >= 1
    ? `rgb(${c(r)}, ${c(g)}, ${c(b)})`
    : `rgba(${c(r)}, ${c(g)}, ${c(b)}, ${alpha})`;
}

/** Mezcla como color-mix(in srgb, a p, b): p = 1 da a, p = 0 da b. */
export function mix(a: RGB, b: RGB, p: number): RGB {
  return [a[0] * p + b[0] * (1 - p), a[1] * p + b[1] * (1 - p), a[2] * p + b[2] * (1 - p)];
}

export const WHITE: RGB = [255, 255, 255];

/** Luminancia relativa WCAG 2.x. */
export function luminance([r, g, b]: RGB): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Relación de contraste WCAG (1 a 21). */
export function contrast(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function hex(text: string): RGB {
  const c = parseColor(text);
  if (!c) throw new Error(`Color no válido: ${text}`);
  return c;
}
