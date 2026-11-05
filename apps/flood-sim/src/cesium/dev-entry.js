// 本地调试入口（不参与最终 demo 构建）：直接创建场景，方便截图迭代。
import * as Cesium from 'cesium';
import { store } from '../store.js';
import { createFloodApp } from './floodApp.js';

window.__Cesium = Cesium;
const app = await createFloodApp({ container: document.getElementById('scene'), store });
window.__floodApp = app;
window.__store = store;
window.__ready = true;
