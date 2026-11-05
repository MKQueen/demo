import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CESIUM_BUILD = path.join(ROOT, 'node_modules/cesium/Build/Cesium');

/**
 * Cesium 运行时资源（Workers / Assets / ThirdParty / Widgets）不能交给 Rollup 打包：
 *   - dev：直接从 node_modules/cesium/Build/Cesium 提供 /cesium/*；
 *   - build：在 dist/cesium/ 下复制一份，供子路径部署使用。
 * 不用第三方 copy 插件，避免其 dev middleware 在不同 Vite 版本下失效。
 */
const MIME: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
};

function cesiumRuntime(): Plugin {
  let isBuild = false;
  return {
    name: 'cbd-cesium-runtime',
    configResolved(config) {
      isBuild = config.command === 'build';
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url || '';
        const pathname = rawUrl.split('?')[0];
        if (!pathname.startsWith('/cesium/')) return next();
        const relative = decodeURIComponent(pathname.slice('/cesium/'.length));
        const filePath = path.resolve(CESIUM_BUILD, relative);
        if (!filePath.startsWith(CESIUM_BUILD + path.sep)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        fs.stat(filePath, (error, stat) => {
          if (error || !stat.isFile()) {
            res.statusCode = 404;
            res.end('Not found');
            return;
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
          res.setHeader('Cache-Control', 'no-cache');
          fs.createReadStream(filePath).pipe(res);
        });
      });
    },
    closeBundle() {
      if (!isBuild) return;
      const dist = path.join(ROOT, 'dist/cesium');
      fs.mkdirSync(dist, { recursive: true });
      for (const dir of ['Workers', 'ThirdParty', 'Assets', 'Widgets']) {
        fs.cpSync(path.join(CESIUM_BUILD, dir), path.join(dist, dir), {
          recursive: true,
          filter: (source) => !source.endsWith('.map'),
        });
      }
    },
  };
}

export default defineConfig({
  // 相对路径构建：dist 可放在任意子目录（合集站点 /demos/cbd-digital-twin/）
  base: './',
  plugins: [vue(), cesiumRuntime()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 6000,
    rollupOptions: {
      output: {
        // Cesium 单独成 chunk，业务迭代不影响它的长效缓存
        manualChunks: {
          cesium: ['cesium'],
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5185,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 5186,
    strictPort: true,
  },
});
