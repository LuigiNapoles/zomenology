import MiniSearch from 'minisearch';
import type { Section, TimelineEvent } from './types';

/** Minúsculas y sin tildes: «París» y «paris» son lo mismo. */
export function normalizeTerm(term: string): string {
  return term.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

interface SearchDoc {
  id: number;
  d: string;
  o: string;
  sec: string;
}

export interface SearchHit {
  id: number;
  /** true = está en el eje (events.json); false = sin fecha (undated.json). */
  dated: boolean;
  /** Índice en su array de eventos. */
  index: number;
}

export const MAX_RESULTS = 20;
/** Resultados de MiniSearch que se reordenan por parecido. */
const RERANK = 200;

/** Distancia de edición (Levenshtein) entre dos palabras cortas. */
export function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = cur;
  }
  return prev[b.length] ?? 0;
}

/** Parecido entre lo escrito y una palabra del evento: 1 = igual, 0,9 = empieza igual, menos si hay errores. */
export function termSimilarity(query: string, term: string): number {
  if (term === query) return 1;
  if (term.startsWith(query)) return 0.9;
  let prefix = 0;
  while (prefix < query.length && query[prefix] === term[prefix]) prefix++;
  const distance = editDistance(query, term);
  return 1 - distance / Math.max(query.length, term.length) + (0.1 * prefix) / query.length;
}

/** Índice de búsqueda tolerante: sin mayúsculas ni tildes, por prefijo y con errores leves. */
export class SearchIndex {
  private mini: MiniSearch<SearchDoc>;
  private where = new Map<number, { dated: boolean; index: number }>();

  constructor(
    dated: readonly TimelineEvent[],
    undated: readonly TimelineEvent[],
    sections: readonly Section[],
  ) {
    this.mini = new MiniSearch<SearchDoc>({
      fields: ['d', 'o', 'sec'],
      idField: 'id',
      processTerm: (term) => {
        const t = normalizeTerm(term);
        return t.length > 0 ? t : null;
      },
      searchOptions: {
        boost: { d: 3 },
        prefix: true,
        // Errores leves: 1 en palabras de 4–5 letras, 2 desde 6 letras.
        fuzzy: (term) => (term.length >= 6 ? 2 : term.length >= 4 ? 1 : false),
        combineWith: 'AND',
      },
    });
    const docs: SearchDoc[] = [];
    const add = (list: readonly TimelineEvent[], isDated: boolean) => {
      list.forEach((e, index) => {
        this.where.set(e.id, { dated: isDated, index });
        docs.push({ id: e.id, d: e.d, o: e.o ?? '', sec: sections[e.s]?.label ?? '' });
      });
    };
    add(dated, true);
    add(undated, false);
    this.mini.addAll(docs);
  }

  search(query: string, limit = MAX_RESULTS): SearchHit[] {
    if (query.trim() === '') return [];
    // Primero los que más se parecen a lo escrito (exacto > prefijo > con errores);
    // a igualdad, la puntuación de MiniSearch.
    const ranked = this.mini
      .search(query)
      .slice(0, RERANK)
      .map((result, order) => {
        let quality = 0;
        for (const q of result.queryTerms) {
          let best = 0;
          for (const t of result.terms) best = Math.max(best, termSimilarity(q, t));
          quality += best;
        }
        return { result, quality, order };
      })
      .sort((a, b) => b.quality - a.quality || a.order - b.order);
    const hits: SearchHit[] = [];
    for (const { result } of ranked) {
      const id = result.id as number;
      const place = this.where.get(id);
      if (place) hits.push({ id, ...place });
      if (hits.length >= limit) break;
    }
    return hits;
  }
}
