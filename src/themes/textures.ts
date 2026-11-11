import type { TextureId } from './periods';

/**
 * Texturas de fondo generadas con SVG (feTurbulence),
 * sin imágenes externas. Se pintan una vez en un canvas fuera de pantalla y se reutilizan.
 */

export interface TextureDef {
  svg: string;
  width: number;
  height: number;
}

/** Ruido de color fijo con transparencia: r, g, b en 0–1. */
function noise(
  id: string,
  rgb: [number, number, number],
  alpha: number,
  frequency: string,
  octaves: number,
  seed: number,
  type: 'fractalNoise' | 'turbulence' = 'fractalNoise',
): string {
  const [r, g, b] = rgb;
  return (
    `<filter id='${id}' x='0' y='0' width='100%' height='100%'>` +
    `<feTurbulence type='${type}' baseFrequency='${frequency}' numOctaves='${octaves}' seed='${seed}' stitchTiles='stitch'/>` +
    `<feColorMatrix values='0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 ${alpha} 0'/>` +
    `</filter><rect width='100%' height='100%' filter='url(#${id})'/>`
  );
}

function svg(width: number, height: number, body: string): TextureDef {
  return {
    width,
    height,
    svg: `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'>${body}</svg>`,
  };
}

export function textureDef(id: TextureId): TextureDef {
  switch (id) {
    case 'limestone':
      return svg(
        256,
        256,
        noise('a', [0.16, 0.12, 0.09], 0.16, '0.8', 2, 3) +
          noise('b', [0.4, 0.33, 0.25], 0.12, '0.035', 3, 11),
      );
    case 'papyrus':
      return svg(
        256,
        256,
        noise('h', [0.42, 0.33, 0.16], 0.18, '0.006 0.5', 2, 4) +
          noise('v', [0.42, 0.33, 0.16], 0.1, '0.5 0.006', 2, 8),
      );
    case 'parchment':
      return svg(
        256,
        256,
        noise('a', [0.45, 0.32, 0.15], 0.14, '0.018', 3, 6) +
          noise('b', [0.3, 0.2, 0.1], 0.08, '0.9', 1, 12),
      );
  }
}

export function textureDataUrl(id: TextureId): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(textureDef(id).svg)}`;
}

const cache = new Map<TextureId, Promise<HTMLCanvasElement>>();

/** Pinta la textura una vez en un canvas fuera de pantalla (se reutiliza como patrón). */
export function loadTexture(id: TextureId): Promise<HTMLCanvasElement> {
  const cached = cache.get(id);
  if (cached) return cached;
  const def = textureDef(id);
  const promise = new Promise<HTMLCanvasElement>((resolve, reject) => {
    const img = new Image(def.width, def.height);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = def.width;
      canvas.height = def.height;
      canvas.getContext('2d')?.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error(`No se pudo crear la textura ${id}`));
    img.src = textureDataUrl(id);
  });
  cache.set(id, promise);
  return promise;
}
