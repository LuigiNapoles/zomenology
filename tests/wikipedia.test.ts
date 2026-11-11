import { describe, expect, it } from 'vitest';
import { wikipediaUrl } from '../src/data/wikipedia';

describe('enlaces a Wikipedia', () => {
  it('construye la dirección del artículo, con tildes, paréntesis y sección', () => {
    expect(wikipediaUrl('Imperio bizantino')).toBe(
      'https://es.wikipedia.org/wiki/Imperio_bizantino',
    );
    expect(wikipediaUrl('Revolución francesa')).toBe(
      'https://es.wikipedia.org/wiki/Revoluci%C3%B3n_francesa',
    );
    expect(wikipediaUrl('Mercurio (planeta)')).toBe(
      'https://es.wikipedia.org/wiki/Mercurio_(planeta)',
    );
    expect(wikipediaUrl('Edad Media#Alta Edad Media')).toBe(
      'https://es.wikipedia.org/wiki/Edad_Media#Alta_Edad_Media',
    );
  });
});
