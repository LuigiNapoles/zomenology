/**
 * Las 4 grandes eras. Ya no cambian el estilo de la página (decisión del 11/11/2026): sirven
 * para orientarse en el minimapa y en la línea de estado, y para elegir la dificultad del quiz.
 */
export type EraId = 'prehistory' | 'antiquity' | 'medieval' | 'contemporary';

export interface Era {
  id: EraId;
  name: string;
  /** Comienzo (año continuo); la primera empieza en −∞. */
  from: number;
}

export const ERAS: readonly Era[] = [
  { id: 'prehistory', name: 'Prehistoria', from: -Infinity },
  { id: 'antiquity', name: 'Antigüedad', from: -3300 },
  { id: 'medieval', name: 'Edad Media y Moderna', from: 476 },
  { id: 'contemporary', name: 'Edad Contemporánea', from: 1789 },
];

/** Era a la que pertenece el instante t. */
export function eraAt(t: number): Era {
  let current = ERAS[0] as Era;
  for (const era of ERAS) {
    if (t >= era.from) current = era;
    else break;
  }
  return current;
}
