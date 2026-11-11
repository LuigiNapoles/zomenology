/** Dirección del artículo de la Wikipedia en español: «Imperio bizantino» → …/wiki/Imperio_bizantino. */
export function wikipediaUrl(article: string): string {
  const [title = '', fragment] = article.split('#');
  const encode = (text: string) => encodeURIComponent(text.trim().replaceAll(' ', '_'));
  return `https://es.wikipedia.org/wiki/${encode(title)}${fragment ? `#${encode(fragment)}` : ''}`;
}
