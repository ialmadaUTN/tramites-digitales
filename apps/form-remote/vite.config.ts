import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'form_remote',
      filename: 'remoteEntry.js',
      manifest: true,
      exposes: { './DynamicForm': './src/DynamicForm.tsx' },
      shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
    }),
  ],
  server: { origin: 'http://localhost:3002', cors: true, hmr: false },
  preview: { host: '127.0.0.1', port: 3002, cors: true },
  build: { target: 'es2022' },
});
