import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MAX_RESULTS,
  SearchIndex,
  editDistance,
  normalizeTerm,
  termSimilarity,
} from '../src/data/search';
import type { DataFile } from '../src/data/types';

const load = (name: string) =>
  JSON.parse(readFileSync(resolve(__dirname, '../public/data', name), 'utf8')) as DataFile;
const dated = load('events.json');
const undated = load('undated.json');
const index = new SearchIndex(dated.events, undated.events, dated.sections);

const ids = (q: string) => index.search(q).map((h) => h.id);

describe('buscador', () => {
  it('normaliza mayúsculas y tildes', () => {
    expect(normalizeTerm('París')).toBe('paris');
    expect(normalizeTerm('ÁFRICA')).toBe('africa');
  });

  it('«haussmann», «Haussmann» y «hausman» encuentran el mismo evento', () => {
    const a = ids('haussmann');
    const b = ids('Haussmann');
    const c = ids('hausman');
    // Evento 7: «Nombramiento de Haussmann como Prefecto del Sena».
    for (const list of [a, b, c]) expect(list).toContain(7);
    expect(new Set(a)).toEqual(new Set(b));
    for (const id of [7, 51, 52]) expect(c).toContain(id);
    // Lo más parecido va primero: los eventos de Haussmann encabezan las tres búsquedas
    // («Haussmannismo» es otra palabra y solo entra por prefijo con la grafía correcta).
    for (const list of [a, b])
      expect(new Set(list.slice(0, 4))).toEqual(new Set([7, 51, 52, 2106]));
    expect(new Set(c.slice(0, 3))).toEqual(new Set([7, 51, 52]));
  });

  it('distancia y parecido entre palabras', () => {
    expect(editDistance('hausman', 'haussmann')).toBe(2);
    expect(termSimilarity('paris', 'paris')).toBe(1);
    expect(termSimilarity('par', 'paris')).toBe(0.9);
    expect(termSimilarity('hausman', 'haussmann')).toBeGreaterThan(
      termSimilarity('hausman', 'hassan'),
    );
  });

  it('busca sin tildes y por prefijo', () => {
    expect(ids('paris').length).toBeGreaterThan(0);
    expect(ids('parís')).toEqual(ids('paris'));
    expect(ids('constantinop').length).toBeGreaterThan(0);
  });

  it('devuelve como mucho 20 resultados', () => {
    expect(index.search('de').length).toBeLessThanOrEqual(MAX_RESULTS);
  });

  it('incluye los eventos sin fecha, marcados como tales', () => {
    // Evento sin fecha: «Mikhail I (Михаил), príncipe de Tver…».
    const hits = index.search('Mikhail Tver');
    const hit = hits.find((h) => h.id === 927);
    expect(hit).toBeDefined();
    expect(hit?.dated).toBe(false);
  });

  it('una búsqueda vacía no devuelve nada', () => {
    expect(index.search('   ')).toEqual([]);
  });
});
