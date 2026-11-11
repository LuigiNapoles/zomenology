/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** «no» en la versión sencilla (sin «Aprender jugando»). */
  readonly VITE_APRENDER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
