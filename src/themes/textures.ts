import type { TextureId } from './periods';

/**
 * Texturas de fondo generadas con SVG (feTurbulence, patrones de líneas y estrellas),
 * sin imágenes externas. Se pintan una vez en un canvas fuera de pantalla y se reutilizan.
 */

export interface TextureDef {
  svg: string;
  width: number;
  height: number;
}

/** Generador pseudoaleatorio con semilla: mismas estrellas en cada carga. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

function stars(): TextureDef {
  const rand = seeded(42);
  const size = 512;
  let body = '';
  for (let i = 0; i < 170; i++) {
    const x = (rand() * size).toFixed(1);
    const y = (rand() * size).toFixed(1);
    const r = (0.4 + rand() * rand() * 1.4).toFixed(2);
    const o = (0.25 + rand() * 0.65).toFixed(2);
    const color = rand() < 0.15 ? '#cfe0ff' : '#ffffff';
    body += `<circle cx='${x}' cy='${y}' r='${r}' fill='${color}' fill-opacity='${o}'/>`;
  }
  return svg(size, size, body);
}

function strata(): TextureDef {
  const bands = [
    [0, 22, '#5a4332', 0.28],
    [22, 14, '#4a3729', 0.2],
    [36, 30, '#6b5140', 0.22],
    [66, 18, '#3f2f24', 0.25],
    [84, 26, '#5f4838', 0.18],
    [110, 18, '#4d3a2c', 0.24],
  ] as const;
  const body =
    bands
      .map(
        ([y, h, c, o]) =>
          `<rect x='0' y='${y}' width='256' height='${h}' fill='${c}' fill-opacity='${o}'/>`,
      )
      .join('') + noise('g', [0.95, 0.85, 0.7], 0.12, '0.85', 2, 7);
  return svg(256, 128, body);
}

function engraving(): TextureDef {
  let body = '';
  for (let x = -64; x < 64 + 64; x += 4) {
    body += `<line x1='${x}' y1='0' x2='${x + 64}' y2='64' stroke='#1d1b18' stroke-opacity='0.06' stroke-width='0.7'/>`;
  }
  return svg(64, 64, body);
}

export function textureDef(id: TextureId): TextureDef {
  switch (id) {
    case 'stars':
      return stars();
    case 'strata':
      return strata();
    case 'limestone':
      return svg(
        256,
        256,
        noise('a', [0.16, 0.12, 0.09], 0.16, '0.8', 2, 3) +
          noise('b', [0.4, 0.33, 0.25], 0.12, '0.035', 3, 11),
      );
    case 'clay':
      return svg(
        256,
        256,
        noise('a', [0.35, 0.22, 0.12], 0.12, '0.65', 2, 5) +
          noise('b', [0.5, 0.33, 0.18], 0.1, '0.04', 2, 9),
      );
    case 'papyrus':
      return svg(
        256,
        256,
        noise('h', [0.42, 0.33, 0.16], 0.18, '0.006 0.5', 2, 4) +
          noise('v', [0.42, 0.33, 0.16], 0.1, '0.5 0.006', 2, 8),
      );
    case 'marble':
      return svg(512, 512, noise('m', [0.35, 0.35, 0.38], 0.16, '0.004 0.012', 5, 2, 'turbulence'));
    case 'parchment':
      return svg(
        256,
        256,
        noise('a', [0.45, 0.32, 0.15], 0.14, '0.018', 3, 6) +
          noise('b', [0.3, 0.2, 0.1], 0.08, '0.9', 1, 12),
      );
    case 'engraving':
      return engraving();
    case 'newsprint':
      return svg(256, 256, noise('a', [0.25, 0.22, 0.18], 0.1, '0.95', 1, 21));
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
