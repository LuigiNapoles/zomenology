import { buildThemeCSS, type ThemeMode } from './theme';

/** Inserta en la página los bloques :root[data-theme='…'] con las variables de cada modo. */
export function installThemes(): void {
  if (document.getElementById('theme-vars')) return;
  const style = document.createElement('style');
  style.id = 'theme-vars';
  style.textContent = buildThemeCSS();
  document.head.append(style);
}

/** Activa el modo claro u oscuro. */
export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  if (root.dataset.theme === mode) return;
  root.dataset.theme = mode;
  // La barra del navegador en el móvil toma el color del fondo.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', mode === 'dark' ? '#262624' : '#FAF9F5');
}

/** Ejecuta `fn` justo después del siguiente pintado (no compite con la primera pintura). */
export function afterNextPaint(fn: () => void): void {
  if (typeof requestAnimationFrame !== 'function') {
    setTimeout(fn, 0);
    return;
  }
  requestAnimationFrame(() => setTimeout(fn, 0));
}
