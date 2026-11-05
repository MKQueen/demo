import { defineConfig } from 'vite';

// 纯静态子路径部署：产物里所有资源都必须相对引用，
// 这样 dist 可以直接放到 /demos/building-atlas/ 下运行。
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
  },
});
