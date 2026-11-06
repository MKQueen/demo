import { defineConfig } from 'vite';

// 纯静态子路径部署：产物内所有资源都用相对路径，dist 可直接放到 /demos/konbini-rain/。
export default defineConfig({
  base: './',
  resolve: { dedupe: ['three'] },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1600,
  },
});
