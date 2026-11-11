import { ALL_THEMES, PERIODS, buildThemeCSS, themeById, type ThemeId } from './periods';
import { textureDataUrl } from './textures';

/** Inserta en la página los bloques :root[data-period='…'] con las variables de cada estilo. */
export function installThemes(): void {
  if (document.getElementById('theme-vars')) return;
  const textures = ALL_THEMES.flatMap((t) =>
    t.texture && !t.id.startsWith('neutral')
      ? [`:root[data-period='${t.id}'] { --texture: url("${textureDataUrl(t.texture)}"); }`]
      : [],
  ).join('\n');
  const style = document.createElement('style');
  style.id = 'theme-vars';
  style.textContent = `${buildThemeCSS()}\n\n${textures}`;
  document.head.append(style);
}

/** Tipografías de un estilo (títulos y adornos). */
function fontsOf(id: ThemeId): string[] {
  const t = themeById(id);
  return [t.titleFont, ...(t.extraFonts ?? [])];
}

function loadFont(family: string): void {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  void document.fonts.load(`700 16px "${family}"`).catch(() => undefined);
}

let loadedAll = false;

/** Ejecuta `fn` justo después del siguiente pintado (no compite con la primera pintura). */
export function afterNextPaint(fn: () => void): void {
  if (typeof requestAnimationFrame !== 'function') {
    setTimeout(fn, 0);
    return;
  }
  requestAnimationFrame(() => setTimeout(fn, 0));
}

/**
 * Activa un estilo: cambia data-period (las variables se interpolan en 600 ms por CSS)
 * y carga sus tipografías y las de los dos periodos vecinos. El resto, cuando el navegador
 * quede libre.
 */
export function applyTheme(id: ThemeId): void {
  const root = document.documentElement;
  if (root.dataset.period === id) return;
  root.dataset.period = id;
  const index = PERIODS.findIndex((p) => p.id === id);
  // La del estilo activo, ya; las de los vecinos, tras pintar (no retrasan la primera pintura).
  for (const f of fontsOf(id)) loadFont(f);
  const near: ThemeId[] = [];
  if (index >= 0) {
    const prev = PERIODS[index - 1];
    const next = PERIODS[index + 1];
    if (prev) near.push(prev.id);
    if (next) near.push(next.id);
  }
  afterNextPaint(() => near.forEach((t) => fontsOf(t).forEach(loadFont)));
  if (!loadedAll) {
    loadedAll = true;
    const rest = () => ALL_THEMES.forEach((t) => fontsOf(t.id).forEach(loadFont));
    if (typeof requestIdleCallback === 'function') requestIdleCallback(rest, { timeout: 5000 });
    else setTimeout(rest, 3000);
  }
}
