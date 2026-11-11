/** F12 «Sorpréndeme»: un evento al azar entre los que dejan ver los filtros. */

export type Random = () => number;

/** Índice al azar en [0, n). */
export function randomInt(n: number, rng: Random): number {
  return Math.min(n - 1, Math.floor(rng() * n));
}

/**
 * Evento al azar entre los `count` del eje que pasan el filtro, distinto de `exclude`
 * (el que ya está abierto) si hay otro. Devuelve −1 si no queda ninguno.
 */
export function randomEvent(
  count: number,
  filter: ((i: number) => boolean) | null,
  rng: Random = Math.random,
  exclude = -1,
): number {
  const candidates: number[] = [];
  for (let i = 0; i < count; i++) {
    if (i !== exclude && (!filter || filter(i))) candidates.push(i);
  }
  if (candidates.length === 0) {
    return exclude >= 0 && exclude < count && (!filter || filter(exclude)) ? exclude : -1;
  }
  return candidates[randomInt(candidates.length, rng)] as number;
}

/** Baraja una copia (Fisher-Yates). */
export function shuffle<T>(items: readonly T[], rng: Random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, rng);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
