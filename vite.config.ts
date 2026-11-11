import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// En GitHub Pages la web vive en /cronologia/ y la versión sencilla en /cronologia/sencilla/.
// En local (npm run dev) se sirve desde la raíz.
export default defineConfig(({ command, mode }) => ({
  plugins: [preact()],
  base:
    command === 'build' ? (mode === 'sencilla' ? '/cronologia/sencilla/' : '/cronologia/') : '/',
}));
