// 静态化部署用的资源路径工具。
//
// 这个 demo 会被挂在合集站的 /demos/mecha-battle/ 子路径下，所以运行时加载的
// 模型、纹理、音频、MediaPipe 资源都不能写死成 "/models/..." 这类站点根路径。
// vite.config.js 里 base 配置为 './'，Vite 构建时会把 import.meta.env.BASE_URL
// 内联成 "./"（开发时是 "/"），这里按 BASE_URL 拼接后即可同时兼容：
//   - 本地 dev：/models/...
//   - 子路径静态部署：./models/...（相对当前页面 /demos/mecha-battle/）
//
// 注意：这个模块不依赖 window/DOM，不参与单元测试的模块循环。
const BASE_URL = (import.meta.env && import.meta.env.BASE_URL) || './';

export function assetUrl(path) {
  return `${BASE_URL}${path}`.replace(/([^:]\/)\/+/g, '$1');
}
