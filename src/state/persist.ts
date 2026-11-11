import { clampView, type View } from '../timeline/scale';
import { THEME_MODES, type ThemeMode } from '../themes/theme';
import { sanitizeFilters, type Filters } from './filters';

/** Enlace directo a un evento: «#e42». Devuelve el id o null. */
export function parseEventHash(hash: string): number | null {
  const m = /^#e(\d+)$/.exec(hash.trim());
  return m ? Number(m[1]) : null;
}

export function eventHash(id: number): string {
  return `#e${id}`;
}

const STORAGE_KEY = 'cronologia:v1';

export interface SavedState {
  view: View | null;
  filters: Filters | null;
  theme: ThemeMode | null;
  sidebarCollapsed: boolean | null;
}

/** Modo guardado; los valores de los antiguos estilos por periodo se traducen al nuevo. */
function sanitizeTheme(value: unknown): ThemeMode | null {
  if (THEME_MODES.includes(value as ThemeMode)) return value as ThemeMode;
  if (value === 'neutral-dark') return 'dark';
  if (value === 'period' || value === 'neutral-light') return 'light';
  return null;
}

function sanitizeView(value: unknown): View | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Partial<Record<keyof View, unknown>>;
  if (v.mode !== 'linear' && v.mode !== 'log') return null;
  if (typeof v.center !== 'number' || typeof v.span !== 'number') return null;
  if (!Number.isFinite(v.center) || !Number.isFinite(v.span) || v.span <= 0) return null;
  return clampView({ mode: v.mode, center: v.center, span: v.span });
}

const EMPTY: SavedState = { view: null, filters: null, theme: null, sidebarCollapsed: null };

/** Lee la vista y los filtros guardados. Si no hay o están dañados, devuelve null en cada parte. */
export function loadSaved(storage: Pick<Storage, 'getItem'> | null = safeStorage()): SavedState {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as {
      view?: unknown;
      filters?: unknown;
      theme?: unknown;
      style?: unknown;
      sidebarCollapsed?: unknown;
    };
    return {
      view: sanitizeView(parsed.view),
      filters: parsed.filters === undefined ? null : sanitizeFilters(parsed.filters),
      theme: sanitizeTheme(parsed.theme ?? parsed.style),
      sidebarCollapsed:
        typeof parsed.sidebarCollapsed === 'boolean' ? parsed.sidebarCollapsed : null,
    };
  } catch {
    return EMPTY;
  }
}

export function save(
  state: { view: View; filters: Filters; theme: ThemeMode; sidebarCollapsed: boolean },
  storage: Pick<Storage, 'setItem'> | null = safeStorage(),
): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Sin almacenamiento (modo privado, cuota llena…): la web sigue funcionando sin recordar.
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
