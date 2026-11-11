import type { DataFile } from './types';

function isDataFile(value: unknown): value is DataFile {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<DataFile>;
  return (
    v.version === 1 &&
    Array.isArray(v.macros) &&
    Array.isArray(v.sections) &&
    Array.isArray(v.events)
  );
}

/** Carga un JSON de public/data (events.json o undated.json). */
export async function loadData(name: 'events.json' | 'undated.json'): Promise<DataFile> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${name}`);
  if (!response.ok) {
    throw new Error(`No se pudo cargar ${name} (${response.status})`);
  }
  const json: unknown = await response.json();
  if (!isDataFile(json)) {
    throw new Error(`${name} no tiene el formato esperado`);
  }
  return json;
}
