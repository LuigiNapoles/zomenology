import type { TimelineEvent } from '../data/types';
import { toRoman } from '../format/dates';
import { PERIODS, type PeriodId } from '../themes/periods';
import type { PreparedEvents } from '../timeline/prepare';
import { randomInt, shuffle, type Random } from './random';

/**
 * F13 Quiz cronológico.
 * - «Ordena»: 4 eventos para poner en orden cronológico (por fecha de comienzo).
 * - «¿Qué siglo?»: un evento y 4 siglos (o milenios) para elegir.
 * Rondas de 10 preguntas sin repetir eventos; solo eventos con fecha exacta.
 */

export type QuizMode = 'order' | 'century';
export type EraChoice = 'all' | PeriodId;

export const ROUND_SIZE = 10;
export const ORDER_SIZE = 4;
export const OPTION_COUNT = 4;
/** «¿Qué siglo?» solo con eventos desde el 10.000 a.C. (antes, ni siglos ni milenios dicen nada). */
export const CENTURY_QUIZ_FROM = -10_000;
/** Desde el 1000 a.C. se pregunta el siglo; antes, el milenio. */
export const CENTURIES_FROM = -1000;
const MAX_CENTURY = 21;
const MILLENNIUM_RANGE = [-10, -2] as const;

/** Años [desde, hasta) de cada opción de dificultad por periodo. */
export function eraRange(era: EraChoice): [number, number] {
  if (era === 'all') return [-Infinity, Infinity];
  const i = PERIODS.findIndex((p) => p.id === era);
  return [PERIODS[i]?.from ?? -Infinity, PERIODS[i + 1]?.from ?? Infinity];
}

export interface Bucket {
  unit: 'century' | 'millennium';
  /** Siglo o milenio con signo, sin 0: 13 = s. XIII, −5 = s. V a.C. */
  n: number;
}

export function bucketOf(year: number): Bucket {
  const unit = year >= CENTURIES_FROM ? 'century' : 'millennium';
  const size = unit === 'century' ? 100 : 1000;
  return { unit, n: year > 0 ? Math.ceil(year / size) : -Math.ceil(-year / size) };
}

export function sameBucket(a: Bucket, b: Bucket): boolean {
  return a.unit === b.unit && a.n === b.n;
}

/** «s. XIII», «s. V a.C.», «III milenio a.C.». */
export function bucketLabel(b: Bucket): string {
  const roman = toRoman(Math.abs(b.n));
  const bc = b.n < 0 ? ' a.C.' : '';
  return b.unit === 'century' ? `s. ${roman}${bc}` : `${roman} milenio${bc}`;
}

function validBucket(b: Bucket): boolean {
  if (b.n === 0) return false;
  if (b.unit === 'century') return b.n >= CENTURIES_FROM / 100 && b.n <= MAX_CENTURY;
  return b.n >= MILLENNIUM_RANGE[0] && b.n <= MILLENNIUM_RANGE[1];
}

/** El siglo o milenio que está `k` pasos más allá, sin pasar por el inexistente 0. */
export function stepBucket(b: Bucket, k: number): Bucket {
  let n = b.n + k;
  if (b.n < 0 && n >= 0) n += 1;
  else if (b.n > 0 && n <= 0) n -= 1;
  return { unit: b.unit, n };
}

function yearOf(e: TimelineEvent | undefined): number {
  return e?.a ?? 0;
}

/**
 * Eventos que pueden salir: fecha exacta (sin «aproximada»), con comienzo y final conocidos,
 * dentro del periodo elegido y que pasen el filtro (si se usan los filtros activos).
 * En «¿Qué siglo?», además, que el evento quepa entero en un siglo o milenio.
 */
export function quizPool(
  data: PreparedEvents,
  mode: QuizMode,
  era: EraChoice,
  filter: ((i: number) => boolean) | null = null,
): number[] {
  const [from, to] = eraRange(era);
  const pool: number[] = [];
  for (let i = 0; i < data.count; i++) {
    if (data.approx[i] || data.open[i]) continue;
    const start = data.start[i] as number;
    if (start < from || start >= to) continue;
    if (filter && !filter(i)) continue;
    if (mode === 'century') {
      const e = data.events[i];
      const a = yearOf(e);
      if (a < CENTURY_QUIZ_FROM || !sameBucket(bucketOf(a), bucketOf(e?.b ?? a))) continue;
    }
    pool.push(i);
  }
  return pool;
}

export interface OrderQuestion {
  kind: 'order';
  /** En el orden en que se muestran (desordenados). */
  items: number[];
}

export interface CenturyQuestion {
  kind: 'century';
  event: number;
  options: Bucket[];
  /** Índice de la opción correcta. */
  answer: number;
}

export type Question = OrderQuestion | CenturyQuestion;

/** Orden correcto: por fecha de comienzo. */
export function sortChronologically(items: readonly number[], data: PreparedEvents): number[] {
  return [...items].sort((a, b) => (data.start[a] as number) - (data.start[b] as number));
}

export function isChronological(items: readonly number[], data: PreparedEvents): boolean {
  for (let k = 1; k < items.length; k++) {
    if ((data.start[items[k - 1] as number] as number) > (data.start[items[k] as number] as number))
      return false;
  }
  return true;
}

export function orderQuestion(
  pool: readonly number[],
  data: PreparedEvents,
  used: ReadonlySet<number>,
  rng: Random,
): OrderQuestion | null {
  // Cuatro eventos de años distintos, para que el orden no sea ambiguo.
  const items: number[] = [];
  const years = new Set<number>();
  for (const i of shuffle(pool, rng)) {
    const year = yearOf(data.events[i]);
    if (used.has(i) || years.has(year)) continue;
    items.push(i);
    years.add(year);
    if (items.length === ORDER_SIZE) break;
  }
  if (items.length < ORDER_SIZE) return null;
  // Que no aparezcan ya ordenados.
  let shown = items;
  for (let tries = 0; tries < 10 && isChronological(shown, data); tries++) {
    shown = shuffle(items, rng);
  }
  if (isChronological(shown, data)) shown = [...shown].reverse();
  return { kind: 'order', items: shown };
}

export function centuryQuestion(
  pool: readonly number[],
  data: PreparedEvents,
  used: ReadonlySet<number>,
  rng: Random,
): CenturyQuestion | null {
  const free = pool.filter((i) => !used.has(i));
  if (free.length === 0) return null;
  const event = free[randomInt(free.length, rng)] as number;
  const correct = bucketOf(yearOf(data.events[event]));

  // Tres opciones falsas cercanas (como mucho a 3 siglos o milenios; si no caben, más lejos).
  const distractors: Bucket[] = [];
  for (let reach = 3; reach <= 8 && distractors.length < OPTION_COUNT - 1; reach += 1) {
    const near: Bucket[] = [];
    for (let k = -reach; k <= reach; k++) {
      if (k === 0) continue;
      const b = stepBucket(correct, k);
      if (validBucket(b) && !distractors.some((d) => sameBucket(d, b))) near.push(b);
    }
    for (const b of shuffle(near, rng)) {
      if (distractors.length < OPTION_COUNT - 1) distractors.push(b);
    }
  }
  if (distractors.length < OPTION_COUNT - 1) return null;
  const options = shuffle([correct, ...distractors], rng);
  return {
    kind: 'century',
    event,
    options,
    answer: options.findIndex((b) => sameBucket(b, correct)),
  };
}

/** Eventos que usa una pregunta. */
export function questionEvents(q: Question): number[] {
  return q.kind === 'order' ? q.items : [q.event];
}

/** Una ronda completa sin eventos repetidos, o null si no hay eventos suficientes. */
export function makeRound(
  mode: QuizMode,
  pool: readonly number[],
  data: PreparedEvents,
  rng: Random = Math.random,
): Question[] | null {
  const used = new Set<number>();
  const round: Question[] = [];
  for (let k = 0; k < ROUND_SIZE; k++) {
    const q =
      mode === 'order'
        ? orderQuestion(pool, data, used, rng)
        : centuryQuestion(pool, data, used, rng);
    if (!q) return null;
    for (const i of questionEvents(q)) used.add(i);
    round.push(q);
  }
  return round;
}

/** Marcador de una ronda: aciertos y racha. */
export interface Score {
  correct: number;
  streak: number;
  bestStreak: number;
}

export const EMPTY_SCORE: Score = { correct: 0, streak: 0, bestStreak: 0 };

export function addAnswer(score: Score, right: boolean): Score {
  const streak = right ? score.streak + 1 : 0;
  return {
    correct: score.correct + (right ? 1 : 0),
    streak,
    bestStreak: Math.max(score.bestStreak, streak),
  };
}

/* Mejor puntuación de cada modo, guardada en localStorage. */

const BEST_KEY = 'cronologia:quiz:v1';
export type BestScores = Record<QuizMode, number>;

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadBest(storage: Pick<Storage, 'getItem'> | null = safeStorage()): BestScores {
  const best: BestScores = { order: 0, century: 0 };
  try {
    const parsed = JSON.parse(storage?.getItem(BEST_KEY) ?? '{}') as Record<string, unknown>;
    for (const mode of ['order', 'century'] as const) {
      const v = parsed[mode];
      if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= ROUND_SIZE) best[mode] = v;
    }
  } catch {
    // Datos dañados: se empieza de cero.
  }
  return best;
}

/** Guarda la puntuación si mejora la anterior. Devuelve la mejor y si es un récord nuevo. */
export function recordScore(
  mode: QuizMode,
  score: number,
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage(),
): { best: number; record: boolean } {
  const best = loadBest(storage);
  if (score <= best[mode]) return { best: best[mode], record: false };
  best[mode] = score;
  try {
    storage?.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    // Sin almacenamiento: el récord vale solo para esta visita.
  }
  return { best: score, record: true };
}
