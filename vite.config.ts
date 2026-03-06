import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';

    return {
      base: isGitHubPages ? '/T-Astro-Web-Studio/' : '/',
      server: {
        port: 6002,
        host: '0.0.0.0',
        allowedHosts: ['localhost', '127.0.0.1']
      },
      plugins: [react()],
      build: {
        rollupOptions: {
          input: {
            main: path.resolve(__dirname, 'index.html'),
            viewer: path.resolve(__dirname, 'viewer/index.html'),
          },
        },
      },

      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

