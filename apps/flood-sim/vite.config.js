import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

/**
 * 用相对 base 构建，保证 demo 可以部署到任意子目录：
 *   https://host/demos/flood-sim/
 *
 * Cesium 的静态资源通过 public/cesium + window.CESIUM_BASE_URL
 * （见 index.html 内联脚本）解决，不依赖绝对路径。
 */
export default defineConfig({
  base: './',
  plugins: [vue()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 4096,
    assetsInlineLimit: 0,
  },
  server: {
    fs: { allow: ['..'] },
  },
  optimizeDeps: {
    include: ['cesium', 'vue'],
  },
});
