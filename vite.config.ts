import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import { resolveApiUrl } from './src/lib/apiUrl.ts';

export default defineConfig(({ command, mode }) => {
  if (command === 'build') resolveApiUrl(loadEnv(mode, process.cwd(), '').VITE_API_BASE_URL, true);
  return {
    server: { host: 'localhost', port: 8080 },
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  };
});
