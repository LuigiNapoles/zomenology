/** Tipos de los JSON generados por scripts/build_data.py. */

export type DateType = 'e' | 'v' | 'm' | 'f' | 'n';

export interface Section {
  name: string;
  label: string;
  macro: number;
}

export interface TimelineEvent {
  id: number;
  /** Índice en `sections`. */
  s: number;
  d: string;
  /** Fecha tal como aparece en el PDF; ausente en los eventos sin fecha. */
  f?: string;
  t?: DateType;
  /** Inicio (año). Ausente solo en eventos sin fecha. */
  a?: number;
  /** Fin (año); se omite si es igual a `a`. */
  b?: number;
  ma?: number;
  da?: number;
  mb?: number;
  db?: number;
  ap?: 1;
  e?: string;
  o?: string;
  p: number;
  /** 1 = rango abierto (sin final); 2 = solo se conoce el final (sin comienzo). */
  x?: 1 | 2;
  /** Artículo de la Wikipedia en español (con «#sección» si la hay), solo en los más importantes. */
  w?: string;
}

export interface DataFile {
  version: number;
  generated: string;
  macros: string[];
  sections: Section[];
  events: TimelineEvent[];
}
