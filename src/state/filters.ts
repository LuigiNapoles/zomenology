import type { DateType } from '../data/types';
import { parseYearInput } from '../format/dates';
import { DATE_TYPES, type PreparedEvents } from '../timeline/prepare';

/** Filtros del eje. Se guardan como texto y listas para poder persistirlos tal cual. */
export interface Filters {
  /** Secciones ocultas (índices de `sections`). */
  hiddenSections: number[];
  /** Tipos de fecha ocultos. */
  hiddenTypes: DateType[];
  /** Ocultar las fechas aproximadas. */
  exactOnly: boolean;
  /** Rango temporal tal como lo escribe el usuario («500 a.C.», «2,5 Ma»…); vacío = sin límite. */
  from: string;
  to: string;
}

export const DEFAULT_FILTERS: Filters = {
  hiddenSections: [],
  hiddenTypes: [],
  exactOnly: false,
  from: '',
  to: '',
};

export function isDefaultFilters(f: Filters): boolean {
  return (
    f.hiddenSections.length === 0 &&
    f.hiddenTypes.length === 0 &&
    !f.exactOnly &&
    f.from.trim() === '' &&
    f.to.trim() === ''
  );
}

/** Límites del rango en tiempo continuo; null si el texto no se entiende. */
export function rangeBounds(f: Filters): {
  from: number | null;
  to: number | null;
  fromError: boolean;
  toError: boolean;
} {
  const from = f.from.trim() ? parseYearInput(f.from) : null;
  const to = f.to.trim() ? parseYearInput(f.to) : null;
  return {
    from: from?.start ?? null,
    to: to?.end ?? null,
    fromError: f.from.trim() !== '' && from === null,
    toError: f.to.trim() !== '' && to === null,
  };
}

/** Función que dice si el evento i del eje pasa los filtros; null si no hay ninguno activo. */
export function compileFilter(f: Filters, data: PreparedEvents): ((i: number) => boolean) | null {
  if (isDefaultFilters(f)) return null;
  const hiddenSection = new Uint8Array(256);
  for (const s of f.hiddenSections) hiddenSection[s] = 1;
  const hiddenType = new Uint8Array(DATE_TYPES.length);
  for (const t of f.hiddenTypes) {
    const k = DATE_TYPES.indexOf(t);
    if (k >= 0) hiddenType[k] = 1;
  }
  const { from, to } = rangeBounds(f);
  const exactOnly = f.exactOnly;
  return (i: number) => {
    if (hiddenSection[data.section[i] as number]) return false;
    if (hiddenType[data.type[i] as number]) return false;
    if (exactOnly && data.approx[i]) return false;
    // El evento se solapa con el rango [from, to).
    if (from !== null && (data.end[i] as number) <= from) return false;
    if (to !== null && (data.start[i] as number) >= to) return false;
    return true;
  };
}

/** Eventos del eje que pasan los filtros. */
export function countVisible(
  filter: ((i: number) => boolean) | null,
  data: PreparedEvents,
): number {
  if (!filter) return data.count;
  let n = 0;
  for (let i = 0; i < data.count; i++) if (filter(i)) n++;
  return n;
}

/** Valida y completa filtros leídos de fuera (localStorage). */
export function sanitizeFilters(value: unknown): Filters {
  if (typeof value !== 'object' || value === null) return DEFAULT_FILTERS;
  const v = value as Partial<Record<keyof Filters, unknown>>;
  const numbers = (x: unknown) =>
    Array.isArray(x) ? x.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 256) : [];
  const types = Array.isArray(v.hiddenTypes)
    ? v.hiddenTypes.filter((t): t is DateType => DATE_TYPES.includes(t as DateType))
    : [];
  return {
    hiddenSections: numbers(v.hiddenSections),
    hiddenTypes: types,
    exactOnly: v.exactOnly === true,
    from: typeof v.from === 'string' ? v.from : '',
    to: typeof v.to === 'string' ? v.to : '',
  };
}
