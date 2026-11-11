import { clampView, type View } from '../timeline/scale';
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
}

function sanitizeView(value: unknown): View | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Partial<Record<keyof View, unknown>>;
  if (v.mode !== 'linear' && v.mode !== 'log') return null;
  if (typeof v.center !== 'number' || typeof v.span !== 'number') return null;
  if (!Number.isFinite(v.center) || !Number.isFinite(v.span) || v.span <= 0) return null;
  return clampView({ mode: v.mode, center: v.center, span: v.span });
}

/** Lee la vista y los filtros guardados. Si no hay o están dañados, devuelve null en cada parte. */
export function loadSaved(storage: Pick<Storage, 'getItem'> | null = safeStorage()): SavedState {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return { view: null, filters: null };
    const parsed = JSON.parse(raw) as { view?: unknown; filters?: unknown };
    return {
      view: sanitizeView(parsed.view),
      filters: parsed.filters === undefined ? null : sanitizeFilters(parsed.filters),
    };
  } catch {
    return { view: null, filters: null };
  }
}

export function save(
  state: { view: View; filters: Filters },
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
