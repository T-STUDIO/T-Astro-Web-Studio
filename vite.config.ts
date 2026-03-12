import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';

    return {
      base: isGitHubPages ? '/T-Astro-Web-Stellar/' : './',
      server: {
        port: process.env.PORT ? parseInt(process.env.PORT) : 6002,
        host: '0.0.0.0',
        allowedHosts: true,
        fs: {
          allow: ['..']
        }
      },
      preview: {
        port: process.env.PORT ? parseInt(process.env.PORT) : 6002,
        host: '0.0.0.0',
        allowedHosts: true
      },
      plugins: [react()],
      build: {
        rollupOptions: {
          input: {
            main: path.resolve(__dirname, 'index.html'),
            alpaca: path.resolve(__dirname, 'alpaca.html'),
            simulator: path.resolve(__dirname, 'simulator.html'),
            test: path.resolve(__dirname, 'test.html'),
            viewer: path.resolve(__dirname, 'viewer/index.html'),
          },
        },
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          'react': path.resolve(__dirname, 'node_modules/react'),
          'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
        },
        dedupe: ['react', 'react-dom'],
      }
    };
});
