/**
 * Hay dos versiones de la web, que salen del mismo código:
 * - completa (por defecto): con «Aprender jugando» (Fase 6);
 * - sencilla: sin esas funciones. Se compila con «npm run build:sencilla» (lee .env.sencilla).
 * Vite sustituye la variable al compilar, así que la versión sencilla no incluye ese código.
 */
export const LEARN = import.meta.env.VITE_APRENDER !== 'no';
