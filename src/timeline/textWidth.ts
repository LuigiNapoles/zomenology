/**
 * Ancho aproximado de un texto sumando el ancho de cada carácter, que se mide una sola vez.
 * Medir las 10.000 etiquetas una a una con measureText bloqueaba el móvil más de medio segundo;
 * así cuesta unos milisegundos. El interletraje (kerning) casi siempre estrecha el texto,
 * de modo que la suma no se queda corta; el margen cubre los pocos casos en que sí.
 */
export class CharWidths {
  private widths = new Map<string, number>();

  /** `measure` mide un texto con la tipografía de las etiquetas. */
  constructor(private measure: (text: string) => number) {}

  /** Olvida lo medido (al cambiar o cargarse la tipografía). */
  reset(): void {
    this.widths.clear();
  }

  has(ch: string): boolean {
    return this.widths.has(ch);
  }

  width(text: string): number {
    let total = 0;
    for (const ch of text) {
      let w = this.widths.get(ch);
      if (w === undefined) {
        w = this.measure(ch);
        this.widths.set(ch, w);
      }
      total += w;
    }
    return Math.ceil(total * MARGIN + 1);
  }
}

/** Margen de seguridad sobre la suma de anchos. */
export const MARGIN = 1.01;

/** Letras medidas por tanda en `warmUp`. */
export const WARM_CHUNK = 40;

/**
 * Mide de antemano todas las letras de `texts`, en tandas cortas que ceden el turno entre sí:
 * medir las letras griegas, cirílicas o hebreas obliga al navegador a buscar otra tipografía,
 * y hacerlo todo de golpe bloquearía la página.
 */
export async function warmUp(
  widths: CharWidths,
  texts: Iterable<string>,
  chunk = WARM_CHUNK,
  pause: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 0)),
): Promise<number> {
  const pending = new Set<string>();
  for (const text of texts) for (const ch of text) if (!widths.has(ch)) pending.add(ch);
  let count = 0;
  for (const ch of pending) {
    widths.width(ch);
    if (++count % chunk === 0) await pause();
  }
  return count;
}
