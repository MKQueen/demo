#!/usr/bin/env node
/**
 * verify-upgrade.mjs —— 富华大厦升级版（建筑 + 东四十条街区语境）端到端验收 + 截图。
 *
 * 覆盖 docs/upgrade-contract.md §6 验收口径：
 *   1. 加载：window.__fuhua.loaded && window.__upgrade.ready，loading 覆盖层消失；
 *   2. 运行时错误：pageerror / console.error / failed request / HTTP 404·5xx 均为 0；
 *   3. 数据：window.__cityStats（buildings > 1500、roads/landuse/poi > 0）、
 *      meta 统计自洽、图层文件存在、白模 GLB 结构、方向（东中街在东 / 东四十条在北 / 东二环在西）、
 *      地标 POI 距离与朝向抽样；
 *   4. 交互：day→dusk→night 三态、图层开关（whiteModels/roads/poi + 全量）、街区鸟瞰视角、
 *      POI 点击飞行、楼层模式进出、小地图 SVG、footer OSM 署名（信息项）；
 *   5. 桌面 1600×1000 与移动 390×844 截图、无横向溢出；
 *   6. 性能：window.__fps / window.__renderInfo / city·dressing stats，fps < 30 记 warning。
 *
 * 用法（务必在仓库根 /Users/one/AI/demo 下执行，以便解析 root 的 playwright）：
 *   node apps/building-atlas/tools/verify-upgrade.mjs
 *   node apps/building-atlas/tools/verify-upgrade.mjs --url http://127.0.0.1:5282/demos/building-atlas/
 *   node apps/building-atlas/tools/verify-upgrade.mjs --mobile          # 只跑移动端
 *   node apps/building-atlas/tools/verify-upgrade.mjs --fallback        # 拦截 data/site 请求，验证优雅降级
 *   node apps/building-atlas/tools/verify-upgrade.mjs --no-shots --json /tmp/x.json
 *
 * 选项：
 *   --url <url>     被测地址，默认 http://127.0.0.1:5173/
 *   --out <dir>     截图输出目录，默认 apps/building-atlas/screenshots/
 *   --json <path>   报告落盘路径，默认 /tmp/building-atlas-upgrade-report.json
 *   --mobile        只跑移动端（390×844）
 *   --fallback      强制模拟 public/data/site 数据缺失（请求返回 404），验证 fallback 降级链路
 *   --no-shots      不写截图（调试/快速验收用）
 *   --headed        有头模式（调试用）
 *   --help          帮助
 *
 * 退出码：0 = PASS（无 fail；warning 不影响），1 = FAIL / 致命加载失败。
 *
 * 说明：
 *  - 只在 screenshots/ 下新增 upgrade-*.jpg，不覆盖原有截图；
 *  - 数据缺失（未跑数据管线）时自动识别为降级场景，只断言「优雅降级」，不误报真实数据缺失；
 *  - 交互步骤失败会继续执行后续步骤（尽量把问题一次性全部暴露）。
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(APP_DIR, '..', '..');

/* ------------------------------- CLI 解析 -------------------------------- */
const HELP = `富华大厦升级版验收脚本

用法：node apps/building-atlas/tools/verify-upgrade.mjs [选项]
  --url <url>     默认 http://127.0.0.1:5173/
  --out <dir>     截图目录，默认 apps/building-atlas/screenshots/
  --json <path>   报告路径，默认 /tmp/building-atlas-upgrade-report.json
  --mobile        只跑移动端（390×844）
  --fallback      强制模拟 data/site 缺失，验证 fallback 降级
  --no-shots      不写截图
  --headed        有头模式
  --help          帮助`;

function parseArgs(argv) {
  const options = {
    url: 'http://127.0.0.1:5173/',
    out: path.join(APP_DIR, 'screenshots'),
    json: '/tmp/building-atlas-upgrade-report.json',
    mobileOnly: false,
    fallback: false,
    noShots: false,
    headed: false,
  };
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = () => {
      i += 1;
      if (i >= args.length) throw new Error(`参数 ${arg} 缺少取值`);
      return args[i];
    };
    if (arg === '--url') options.url = next();
    else if (arg === '--out') options.out = path.resolve(next());
    else if (arg === '--json') options.json = path.resolve(next());
    else if (arg === '--mobile') options.mobileOnly = true;
    else if (arg === '--fallback') options.fallback = true;
    else if (arg === '--no-shots') options.noShots = true;
    else if (arg === '--headed') options.headed = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(HELP);
      process.exit(0);
    } else throw new Error(`未知参数：${arg}\n\n${HELP}`);
  }
  return options;
}

let OPTIONS;
try {
  OPTIONS = parseArgs(process.argv);
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exit(1);
}

/* ------------------------------ Playwright 加载 --------------------------- */
// 脚本放在 apps/building-atlas/tools/，而 playwright 装在仓库 root。
// 在仓库根执行时 `import('playwright')` 可解析；否则用 createRequire 从 root 兜底。
async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const require = createRequire(path.join(REPO_ROOT, 'package.json'));
    return require('playwright');
  }
}

/* ------------------------------- 通用工具 -------------------------------- */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nowIso = () => new Date().toISOString();
const fmtKB = (bytes) => `${Math.round(bytes / 1024)} KB`;

function normalizeBaseUrl(raw) {
  const url = new URL(raw);
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
}

async function httpGet(url, { kind = 'json', timeout = 30000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: kind === 'json' ? { Accept: 'application/json' } : { Accept: '*/*' },
      cache: 'no-cache',
    });
    if (!response.ok) return { ok: false, status: response.status, url: String(url) };
    if (kind === 'json') {
      const text = await response.text();
      const first = text.trimStart().charAt(0);
      if (first !== '{' && first !== '[') return { ok: false, status: response.status, url: String(url), error: '响应不是 JSON' };
      return { ok: true, status: response.status, data: JSON.parse(text), url: String(url) };
    }
    if (kind === 'text') {
      const text = await response.text();
      return { ok: true, status: response.status, text, url: String(url) };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return { ok: true, status: response.status, buffer, url: String(url) };
  } catch (error) {
    return { ok: false, error: String(error && error.message ? error.message : error), url: String(url) };
  } finally {
    clearTimeout(timer);
  }
}

async function httpGetJsonRetry(url, attempts = 3) {
  let last = null;
  for (let i = 0; i < attempts; i += 1) {
    last = await httpGet(url, { kind: 'json', timeout: 15000 });
    if (last.ok) return last;
    await sleep(700);
  }
  return last;
}

/* --------------------------------- 状态收集 ------------------------------ */
const checks = [];
const notes = [];
const screenshots = [];
const artifacts = {};
// 截图开关：--no-shots 或「非真实数据模式」时不写交付截图，避免 fallback 图覆盖正式截图
let shotsEnabled = !OPTIONS.noShots;

const SEVERITY = { FAIL: 'fail', WARN: 'warn', INFO: 'info' };

/**
 * 记录一条断言。
 * @param {string} section 分组
 * @param {string} name 断言名
 * @param {boolean} pass 是否通过
 * @param {object} [extra] expected / actual / severity / detail
 */
function check(section, name, pass, extra = {}) {
  const severity = extra.severity || SEVERITY.FAIL;
  const item = {
    section,
    name,
    pass: Boolean(pass),
    severity,
    expected: extra.expected !== undefined ? extra.expected : null,
    actual: extra.actual !== undefined ? extra.actual : null,
    detail: extra.detail || null,
  };
  checks.push(item);
  return item;
}

/** 信息项：永远不参与 PASS/FAIL，只进报告。 */
function info(section, name, actual, detail = null) {
  return check(section, name, true, { severity: SEVERITY.INFO, actual, detail });
}

function note(message) {
  notes.push(message);
}

const safeStringify = (value) => {
  try { return JSON.stringify(value); } catch { return String(value); }
};
const shortValue = (value, max = 220) => {
  const text = typeof value === 'string' ? value : safeStringify(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
};

/* ------------------------------- 页面采集器 ------------------------------ */
function createBucket(label) {
  return {
    label,
    pageErrors: [],
    consoleErrors: [],
    consoleWarnings: [],
    failedRequests: [],
    httpErrors: [],
    responses: [],
    loads: [],
  };
}

function attachCollectors(page, bucket) {
  page.on('load', () => bucket.loads.push({ at: Date.now() }));
  page.on('pageerror', (error) => {
    bucket.pageErrors.push({ message: String(error && error.message ? error.message : error), stack: String(error && error.stack || '').split('\n').slice(0, 4).join('\n') });
  });
  page.on('console', (message) => {
    const type = message.type();
    const entry = { type, text: message.text().slice(0, 500), location: message.location() };
    if (type === 'error') bucket.consoleErrors.push(entry);
    else if (type === 'warning') bucket.consoleWarnings.push(entry);
  });
  page.on('requestfailed', (request) => {
    bucket.failedRequests.push({ method: request.method(), url: request.url(), error: request.failure()?.errorText || 'failed' });
  });
  page.on('response', (response) => {
    const status = response.status();
    if (status >= 400) {
      bucket.httpErrors.push({ status, url: response.url() });
    }
    bucket.responses.push({ status, url: response.url() });
  });
}

/**
 * 过滤两类「非应用缺陷」的网络噪音：
 *  1) --fallback 场景里脚本故意注入的 data/site 404；
 *  2) 同一 URL 已拿到 2xx 响应、但仍被 Chromium 标记 ERR_ABORTED 的请求
 *     （Node 静态服务 + 无头浏览器下已知竞态；GLB 实际已完整加载，root 全站验收脚本同样按 warning 处理）。
 */
function filterExpectedNoise(bucket, fallbackForced) {
  const okUrls = new Set(
    bucket.responses.filter((item) => item.status >= 200 && item.status < 400).map((item) => item.url),
  );
  const abortedRequests = [];
  const realFailed = [];
  for (const item of bucket.failedRequests) {
    if (/ERR_ABORTED/.test(item.error) && okUrls.has(item.url)) abortedRequests.push(item);
    else realFailed.push(item);
  }
  if (!fallbackForced) {
    return { ...bucket, failedRequests: realFailed, abortedRequests };
  }
  const expected = (url) => /\/data\/site\//.test(url);
  const networkNoise = (item) => /Failed to load resource/i.test(item.text)
    || expected((item.location && item.location.url) || '');
  return {
    ...bucket,
    // --fallback 时 data/site 的 404 是脚本故意注入的；浏览器会为 fetch 失败打一条
    // 「Failed to load resource: 404」网络层 console 记录（不是应用 console.error 调用），
    // 降级断言只看应用自身是否 error/抛异常，因此把这类网络层噪音过滤掉。
    consoleErrors: bucket.consoleErrors.filter((item) => !networkNoise(item)),
    consoleWarnings: bucket.consoleWarnings,
    httpErrors: bucket.httpErrors.filter((item) => !expected(item.url)),
    failedRequests: realFailed.filter((item) => !expected(item.url)),
    abortedRequests: abortedRequests.filter((item) => !expected(item.url)),
  };
}

function isDegradeWarning(text) {
  return /fallback|降级|失败|fail|error|加载失败|不可用/i.test(text);
}

/* ------------------------------- 页面辅助 -------------------------------- */
async function click(page, selector, { timeout = 8000 } = {}) {
  const locator = page.locator(selector).first();
  try {
    await locator.click({ timeout });
  } catch (error) {
    try {
      await locator.click({ force: true, timeout: 3000 });
    } catch {
      throw error;
    }
  }
}

async function textOf(page, selector, fallback = '') {
  try {
    return (await page.locator(selector).first().innerText({ timeout: 3000 })).trim();
  } catch {
    return fallback;
  }
}

async function isVisible(page, selector) {
  try {
    return await page.locator(selector).first().isVisible();
  } catch {
    return false;
  }
}

async function canvasHash(page) {
  try {
    const canvas = page.locator('#viewport canvas').first();
    if ((await canvas.count()) === 0) return null;
    const buffer = await canvas.screenshot({ type: 'png' });
    return crypto.createHash('sha1').update(buffer).digest('hex');
  } catch {
    return null;
  }
}

async function screenshotsImpl(page, outDir, name, options = {}) {
  const { quality = 88, fullPage = false } = options;
  if (!shotsEnabled) return null;
  const file = path.join(outDir, name);
  const buffer = await page.screenshot({ type: 'jpeg', quality, fullPage });
  fs.writeFileSync(file, buffer);
  const record = {
    name,
    path: path.relative(process.cwd(), file) || file,
    absolutePath: file,
    bytes: buffer.length,
    size: fmtKB(buffer.length),
  };
  screenshots.push(record);
  return record;
}

async function waitForTime(page, expected, timeout = 6000) {
  await page.waitForFunction(
    (value) => window.__fuhua && window.__fuhua.time === value,
    expected,
    { timeout, polling: 60 },
  );
}

async function evalUpgradeState(page) {
  return page.evaluate(() => {
    const safe = (fn, fallback = null) => {
      try { return fn(); } catch { return fallback; }
    };
    const fuhua = window.__fuhua;
    const upgrade = window.__upgrade;
    return {
      url: location.href,
      title: document.title,
      readyState: document.readyState,
      hasFuhua: Boolean(fuhua),
      fuhuaLoaded: safe(() => fuhua.loaded),
      hasUpgrade: Boolean(upgrade),
      upgradeReady: safe(() => upgrade.ready),
      hasCity: safe(() => Boolean(upgrade.city)),
      hasAtmo: safe(() => Boolean(upgrade.atmo)),
      hasDressing: safe(() => Boolean(upgrade.dressing)),
      time: safe(() => fuhua.time),
      night: safe(() => fuhua.night),
      bodyNight: document.body.classList.contains('is-night'),
      loadingHidden: document.querySelector('#loading')?.classList.contains('hidden') ?? null,
      viewName: document.querySelector('#view-name')?.textContent?.trim() || '',
      statusText: document.querySelector('#status-text')?.textContent?.trim() || '',
      loadProgress: document.querySelector('#load-progress')?.textContent?.trim() || '',
      loadProgressCity: document.querySelector('#load-progress-city')?.textContent?.trim() || '',
      canvas: (() => {
        const canvas = document.querySelector('#viewport canvas');
        return canvas ? { width: canvas.width, height: canvas.height, clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight } : null;
      })(),
      loadingText: document.querySelector('#loading')?.innerText?.slice(0, 300) || '',
    };
  });
}

async function evalCityData(page) {
  return page.evaluate(() => {
    const safe = (fn, fallback = null) => {
      try { return fn(); } catch { return fallback; }
    };
    const fuhua = window.__fuhua;
    const upgrade = window.__upgrade;
    const city = safe(() => upgrade.city);
    const data = safe(() => city && city.data, null);
    const roads = safe(() => (data && Array.isArray(data.roads) ? data.roads : []), []);
    const pois = safe(() => (data && Array.isArray(data.poi) ? data.poi : []), []);
    const countOf = (arr) => (Array.isArray(arr) ? arr.length : 0);

    /** 道路点集平均 x/z：用于验证「东中街在东 / 东四十条在北 / 东二环在西」。 */
    const roadOrientation = () => {
      const groups = {};
      const add = (key, matcher) => {
        const features = roads.filter((road) => matcher(String(road.name || road.ref || '')));
        if (!features.length) return;
        let sx = 0;
        let sz = 0;
        let n = 0;
        for (const feature of features) {
          const points = Array.isArray(feature.points)
            ? feature.points
            : (feature.geometry && Array.isArray(feature.geometry.coordinates) ? feature.geometry.coordinates : []);
          for (const point of points) {
            if (!Array.isArray(point)) continue;
            const x = Number(point[0]);
            const z = Number(point[1]);
            if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
            sx += x;
            sz += z;
            n += 1;
          }
        }
        if (!n) return;
        groups[key] = {
          features: features.length,
          points: n,
          avgX: Math.round((sx / n) * 10) / 10,
          avgZ: Math.round((sz / n) * 10) / 10,
        };
      };
      add('东中街', (name) => name.includes('东中街'));
      add('东四十条', (name) => name.includes('东四十条'));
      add('东二环', (name) => name.includes('东二环') || name.includes('东二环路'));
      add('朝阳门北大街', (name) => name.includes('朝阳门北大街'));
      add('东直门南大街', (name) => name.includes('东直门南大街'));
      return groups;
    };

    const poiSample = (query, { kind = null, exact = false, exclude = [] } = {}) => {
      let matches = pois.filter((poi) => {
        const name = String(poi.name || '');
        if (!name.includes(query)) return false;
        if (kind && String(poi.kind || '') !== kind) return false;
        return true;
      });
      matches = matches.filter((poi) => {
        const name = String(poi.name || '');
        return !exclude.some((fragment) => name.includes(fragment));
      });
      if (!matches.length) return null;
      const exactMatches = matches.filter((poi) => String(poi.name || '').trim() === query);
      const pool = exact && exactMatches.length ? exactMatches : matches;
      pool.sort((a, b) => (Number(a.distanceM) || 0) - (Number(b.distanceM) || 0));
      const poi = pool[0];
      const x = Number(poi.x) || 0;
      const z = Number(poi.z) || 0;
      return {
        name: poi.name,
        kind: poi.kind,
        x: Math.round(x * 10) / 10,
        z: Math.round(z * 10) / 10,
        distanceM: Math.round((Number(poi.distanceM) || 0) * 10) / 10,
        distanceFromXZ: Math.round(Math.hypot(x, z) * 10) / 10,
        weight: poi.weight,
        candidates: pool.slice(0, 5).map((item) => `${item.name}(${Math.round(Number(item.distanceM) || 0)}m)`),
      };
    };

    const minimap = (() => {
      const svg = document.querySelector('#context-map svg');
      if (!svg) return null;
      return {
        paths: svg.querySelectorAll('path').length,
        polylines: svg.querySelectorAll('polyline').length,
        polygons: svg.querySelectorAll('polygon').length,
        lines: svg.querySelectorAll('line').length,
        circles: svg.querySelectorAll('circle').length,
        texts: svg.querySelectorAll('text').length,
        groups: svg.querySelectorAll('g').length,
      };
    })();

    const cityStats = safe(() => window.__cityStats, null);
    const meta = safe(() => city && city.meta, null);
    const atmo = safe(() => {
      const a = upgrade.atmo;
      if (!a) return null;
      return {
        preset: a.preset,
        hasComposer: Boolean(a.composer),
        hasSky: Boolean(a.sky),
        hasSun: Boolean(a.sun),
      };
    }, null);
    const dressing = safe(() => {
      const d = upgrade.dressing;
      if (!d) return null;
      return {
        stats: d.stats || null,
        layers: d.layers || null,
        groupVisible: d.group ? d.group.visible : null,
      };
    }, null);

    const poiNames = pois.map((poi) => String(poi.name || ''));
    const requiredPoiHints = [
      '东四十条', '东直门', '朝阳门', '保利', '港澳中心', '首创', '亚洲大酒店', '新中',
      '阳光国际', '中国移动', '东环广场', '新保利', '五矿', '天辰', '工人体育馆',
      '北京喜剧院', '外交部', '簋街', '悠唐', '丰联',
    ];

    return {
      fuhuaLoaded: safe(() => fuhua.loaded),
      upgradeReady: safe(() => upgrade.ready),
      time: safe(() => fuhua.time),
      cityStats,
      cityMeta: meta
        ? {
          name: meta.name,
          source: meta.source,
          attribution: meta.attribution,
          license: meta.license,
          radiusM: meta.radiusM,
          origin: meta.origin,
          fallback: Boolean(meta.fallback),
          stats: meta.stats || null,
          layers: meta.layers || null,
        }
        : null,
      dataCounts: {
        roads: countOf(roads),
        landuse: countOf(safe(() => data.landuse, [])),
        poi: pois.length,
        site: countOf(safe(() => data.site, [])),
      },
      layers: safe(() => (upgrade.city ? { ...upgrade.city.layers } : null)),
      roadOrientation: roadOrientation(),
      poiSample: {
        dongsishitiaoMetro: poiSample('东四十条'),
        polyPlaza: poiSample('保利大厦', { exact: true, exclude: ['新保利大厦'] }),
        capitalBuilding: poiSample('首创大厦', { exact: true }),
        polyTheatre: poiSample('保利剧院'),
      },
      poiNames,
      poiNamesCovered: requiredPoiHints.filter((hint) => poiNames.some((name) => name.includes(hint))),
      poiDistanceConsistent: (() => {
        let checked = 0;
        let bad = 0;
        let maxDeviation = 0;
        for (const poi of pois) {
          const x = Number(poi.x);
          const z = Number(poi.z);
          const d = Number(poi.distanceM);
          if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(d)) continue;
          checked += 1;
          const magnitude = Math.hypot(x, z);
          const deviation = Math.abs(magnitude - d);
          if (deviation > maxDeviation) maxDeviation = deviation;
          if (deviation > 1) bad += 1;
        }
        return { checked, bad, maxDeviation: Math.round(maxDeviation * 100) / 100 };
      })(),
      minimap,
      landmarkCount: document.querySelectorAll('#landmark-list button').length,
      contextRange: document.querySelector('#context-range')?.textContent?.trim() || '',
      statBuildings: document.querySelector('#stat-buildings')?.textContent?.trim() || '',
      statRoads: document.querySelector('#stat-roads')?.textContent?.trim() || '',
      statTransit: document.querySelector('#stat-transit')?.textContent?.trim() || '',
      footerText: document.querySelector('footer')?.textContent?.replace(/\s+/g, ' ').trim() || '',
      atmo,
      dressing,
      cityApi: safe(() => (city ? Object.keys(city).filter((key) => typeof city[key] === 'function') : []), []),
      cityMissingApi: safe(() => {
        if (!city) return ['city 不存在'];
        const required = ['setLayer', 'toggleLayer', 'setAllVisible', 'setNight', 'setHighlightSite', 'update', 'minimapSvg', 'poisWithin', 'dispose'];
        return required.filter((fn) => typeof city[fn] !== 'function');
      }, ['无法读取 city']),
      cityFields: safe(() => (city ? Object.keys(city) : []), []),
      byNameIsMap: safe(() => Boolean(data && data.byName instanceof Map)),
      byNameSize: safe(() => (data && data.byName instanceof Map ? data.byName.size : null)),
      atmoApi: safe(() => (upgrade.atmo ? Object.keys(upgrade.atmo).filter((key) => typeof upgrade.atmo[key] === 'function') : []), []),
      dressingApi: safe(() => (upgrade.dressing ? Object.keys(upgrade.dressing).filter((key) => typeof upgrade.dressing[key] === 'function') : []), []),
      cityLabelCount: safe(() => document.querySelectorAll('#city-labels > .city-poi').length),
      cityLabelVisibleCount: safe(() => [...document.querySelectorAll('#city-labels > .city-poi')].filter((el) => !el.hidden && (el.textContent || '').trim()).length),
      cityRingLabelCount: safe(() => document.querySelectorAll('#city-labels > .city-ring-label').length),
      cityLabelTexts: safe(() => [...document.querySelectorAll('#city-labels > .city-poi')].filter((el) => !el.hidden).slice(0, 20).map((el) => (el.textContent || '').trim()).filter(Boolean)),
      cityGroupVisible: safe(() => (city && city.group ? city.group.visible : null)),
      cityLabelsVisible: safe(() => {
        const host = document.querySelector('#city-labels');
        if (!host) return null;
        const style = window.getComputedStyle(host);
        return style.display !== 'none' && host.children.length > 0;
      }),
      upgradeStats: safe(() => upgrade.stats, null),
      sceneStats: safe(() => window.__sceneStats, null),
      fps: safe(() => window.__fps || null),
      renderInfo: safe(() => window.__renderInfo || null),
      floor: safe(() => {
        const api = window.__fuhuaFloor;
        if (!api) return null;
        const state = api.state;
        return { ...state, busy: api.busy, stats: api.stats };
      }),
    };
  });
}

/* ------------------------------ 数据产物校验 ----------------------------- */
function parseGlb(buffer) {
  if (!buffer || buffer.byteLength < 20) throw new Error('GLB 文件过小');
  const magic = buffer.readUInt32LE(0);
  if (magic !== 0x46546c67) throw new Error(`不是 GLB（magic=0x${magic.toString(16)}）`);
  const version = buffer.readUInt32LE(4);
  const declaredLength = buffer.readUInt32LE(8);
  const jsonLength = buffer.readUInt32LE(12);
  const jsonType = buffer.readUInt32LE(16);
  if (jsonType !== 0x4e4f534a) throw new Error('首个 chunk 不是 JSON');
  if (20 + jsonLength > buffer.byteLength) throw new Error('JSON chunk 越界');
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'));
  const accessors = json.accessors || [];
  let triangles = 0;
  let primitives = 0;
  let vertexColoredPrimitives = 0;
  let nonTrianglePrimitives = 0;
  for (const mesh of json.meshes || []) {
    for (const primitive of mesh.primitives || []) {
      primitives += 1;
      if (primitive.mode !== undefined && primitive.mode !== 4) nonTrianglePrimitives += 1;
      const indices = primitive.indices != null ? accessors[primitive.indices] : null;
      const positions = primitive.attributes && primitive.attributes.POSITION != null ? accessors[primitive.attributes.POSITION] : null;
      const count = indices ? Number(indices.count) : positions ? Number(positions.count) : 0;
      triangles += Math.floor(Number(count) / 3);
      if (primitive.attributes && primitive.attributes.COLOR_0 != null) vertexColoredPrimitives += 1;
    }
  }
  return {
    version,
    declaredLength,
    actualLength: buffer.byteLength,
    meshes: (json.meshes || []).length,
    primitives,
    triangles,
    vertexColoredPrimitives,
    nonTrianglePrimitives,
    nodes: (json.nodes || []).length,
    materials: (json.materials || []).length,
    generator: (json.asset && json.asset.generator) || null,
    extensionsUsed: json.extensionsUsed || [],
  };
}

function compareCount(section, label, metaCount, cityCount) {
  if (!Number.isFinite(Number(metaCount)) || !Number.isFinite(Number(cityCount))) {
    return check(section, `${label} 计数可比较`, false, { severity: SEVERITY.WARN, expected: metaCount, actual: cityCount });
  }
  const expected = Number(metaCount);
  const actual = Number(cityCount);
  const tolerance = Math.max(3, Math.round(expected * 0.02));
  const diff = Math.abs(actual - expected);
  return check(section, `${label} 计数与 meta 自洽`, diff <= tolerance, {
    expected: `${expected}（±${tolerance}）`,
    actual,
    severity: SEVERITY.WARN,
  });
}

/**
 * 静态部署检查（契约 §6）：index.html 中是否有绝对根路径资源引用（dist 子路径部署会 404）。
 * dev server 会注入 /@vite/client 等绝对路径，属预期（INFO）。
 */
async function verifyStaticDeploy(baseUrl, section) {
  const pageUrl = String(baseUrl);
  const result = await httpGet(pageUrl, { kind: 'text', timeout: 20000 });
  if (!result.ok) {
    check(section, 'index.html 可访问', false, { expected: 'HTTP 200', actual: result.status || result.error });
    return { isDev: false };
  }
  const html = result.text;
  const isDev = /@vite\/client/.test(html);
  const absoluteRefs = [...html.matchAll(/(?:src|href)="(\/(?!\/)[^"]*)"/g)].map((match) => match[1]);
  if (isDev) {
    info(section, 'dev server 资源引用', absoluteRefs.slice(0, 10));
    note('dev server（Vite）会注入 /@vite/client 等绝对路径，属预期；dist 子路径部署检查以构建产物为准。');
  } else {
    check(section, 'dist 无绝对根路径资源引用（子路径部署安全）', absoluteRefs.length === 0, {
      expected: 0, actual: absoluteRefs.length, detail: absoluteRefs.slice(0, 10),
    });
    const baseHref = (html.match(/<base\s+href="([^"]+)"/i) || [])[1] || null;
    info(section, '构建产物引用统计', { isDev, baseHref, absoluteRefs: absoluteRefs.slice(0, 10) });
  }
  return { isDev, absoluteRefs };
}

/**
 * 校验 public/data/site 产物：文件存在、meta 字段、GeoJSON/POI 结构、GLB 结构。
 * @returns {Promise<{available: boolean, meta: object|null, integrity: object}>}
 */
async function verifyDataArtifacts(baseUrl, section) {
  const siteRoot = new URL('data/site/', baseUrl);
  const out = {
    available: false,
    meta: null,
    metaUrl: String(new URL('meta.json', siteRoot)),
    layers: [],
    glb: null,
    warnings: [],
  };

  const metaResult = await httpGetJsonRetry(out.metaUrl);
  if (!metaResult.ok) {
    out.metaError = metaResult;
    return out;
  }
  out.available = true;
  const meta = metaResult.data;
  out.meta = meta;

  const finite = (value) => Number.isFinite(Number(value));
  const missing = [];
  if (!meta.origin || !finite(meta.origin.lon) || !finite(meta.origin.lat)) missing.push('origin.lon/lat');
  if (!Array.isArray(meta.bbox) || meta.bbox.length !== 4) missing.push('bbox[4]');
  if (!finite(meta.radiusM)) missing.push('radiusM');
  if (!meta.attribution || !/OpenStreetMap/i.test(String(meta.attribution))) missing.push('attribution');
  if (!meta.license || !/ODbL/i.test(String(meta.license))) missing.push('license');
  if (!meta.stats || !finite(meta.stats.buildings)) missing.push('stats.buildings');
  const requiredLayers = ['whiteModels', 'roads', 'landuse', 'poi', 'siteFootprint'];
  const layers = meta.layers || {};
  for (const key of requiredLayers) {
    if (!layers[key] || !layers[key].path) missing.push(`layers.${key}.path`);
  }
  check(section, 'meta.json 字段契约完整', missing.length === 0, {
    expected: requiredLayers.join(' / ') + ' + origin/bbox/radius/attribution/license/stats',
    actual: missing.length ? `缺少：${missing.join('、')}` : '完整',
    detail: missing.length ? shortValue(meta) : null,
  });

  const resolveLayer = (layerPath) => {
    if (/^(https?:)?\/\//i.test(layerPath) || layerPath.startsWith('data:')) return layerPath;
    const clean = layerPath.replace(/^\.\//, '');
    return new URL(clean, baseUrl).href;
  };

  // 各图层文件：存在性 + 结构 + 计数
  for (const key of requiredLayers) {
    const layer = layers[key];
    if (!layer || !layer.path) continue;
    const url = resolveLayer(layer.path);
    const record = { key, path: layer.path, url, status: null, ok: false };
    if (key === 'whiteModels') {
      const result = await httpGet(url, { kind: 'buffer', timeout: 60000 });
      record.status = result.status || null;
      record.ok = Boolean(result.ok);
      if (result.ok) {
        record.bytes = result.buffer.byteLength;
        record.size = fmtKB(result.buffer.byteLength);
        try {
          const glb = parseGlb(result.buffer);
          record.glb = glb;
          out.glb = glb;
          check(section, 'white-models.glb 结构有效（GLB v2 + JSON chunk）',
            glb.version === 2 && glb.meshes >= 1 && glb.declaredLength === glb.actualLength,
            { expected: 'version=2 / meshes>=1 / declaredLength==fileSize', actual: { version: glb.version, meshes: glb.meshes, declared: glb.declaredLength, actual: glb.actualLength } });
          check(section, 'white-models.glb 三角面 < 120k', glb.triangles > 0 && glb.triangles < 120000,
            { expected: '< 120000', actual: glb.triangles });
          check(section, 'white-models.glb 文件 < 5MB', result.buffer.byteLength < 5 * 1024 * 1024,
            { expected: '< 5 MB', actual: fmtKB(result.buffer.byteLength) });
          check(section, 'white-models.glb 顶点色 COLOR_0', glb.vertexColoredPrimitives > 0,
            { expected: '> 0 个 primitive 带 COLOR_0', actual: glb.vertexColoredPrimitives });
          check(section, 'white-models.glb 无外部解码依赖（DRACO/meshopt）',
            !(glb.extensionsUsed || []).some((ext) => /draco|meshopt/i.test(String(ext))),
            { expected: '未使用 DRACO/meshopt', actual: glb.extensionsUsed });
          if (Number(layers.whiteModels.count) > 0) {
            const expected = Number(layers.whiteModels.count);
            check(section, '白模栋数与 meta.layers.whiteModels.count 一致', expected > 1500,
              { expected: `> 1500（meta=${expected}）`, actual: expected, severity: SEVERITY.WARN });
          }
          info(section, 'white-models.glb 明细', glb);
        } catch (error) {
          record.ok = false;
          check(section, 'white-models.glb 可解析', false, { expected: '有效 GLB', actual: String(error.message || error) });
        }
      } else {
        check(section, 'white-models.glb 可访问', false, { expected: 'HTTP 200', actual: result.status || result.error || '失败' });
      }
    } else {
      const result = await httpGetJsonRetry(url, 2);
      record.status = result.status || null;
      record.ok = Boolean(result.ok);
      if (!result.ok) {
        check(section, `${key} 文件可访问`, false, { expected: 'HTTP 200 JSON', actual: result.status || result.error || '失败' });
        out.layers.push(record);
        continue;
      }
      let features = [];
      let count = 0;
      if (key === 'poi') {
        const pois = Array.isArray(result.data) ? result.data : (Array.isArray(result.data.pois) ? result.data.pois : []);
        count = pois.length;
        let badDistance = 0;
        for (const poi of pois) {
          if (typeof poi.name !== 'string' || !poi.name.trim()) badDistance = -1;
          if (badDistance >= 0 && Number.isFinite(Number(poi.x)) && Number.isFinite(Number(poi.z)) && Number.isFinite(Number(poi.distanceM))) {
            if (Math.abs(Math.hypot(Number(poi.x), Number(poi.z)) - Number(poi.distanceM)) > 1) badDistance += 1;
          }
        }
        check(section, 'poi.json 全部 distanceM = hypot(x,z)', badDistance === 0,
          { expected: '0 个不一致（±1m）', actual: badDistance < 0 ? '存在空 name' : `${badDistance} 个不一致` });
        check(section, 'poi.json 数量 > 0', count > 0, { expected: '> 0', actual: count });
      } else if (key === 'siteFootprint') {
        features = Array.isArray(result.data.features) ? result.data.features : (Array.isArray(result.data) ? result.data : []);
        count = features.length;
        const kinds = new Set(features.map((feature) => String((feature.properties || {}).kind || feature.kind || '').toLowerCase()));
        check(section, 'site-footprint 含 site/tower 要素', kinds.has('site') && kinds.has('tower'),
          { expected: 'site + tower', actual: [...kinds].join('/'), severity: SEVERITY.WARN });
      } else {
        features = Array.isArray(result.data.features) ? result.data.features : (Array.isArray(result.data) ? result.data : []);
        count = features.length;
        const expectedCount = Number(layers[key] && layers[key].count);
        if (Number.isFinite(expectedCount) && expectedCount > 0) {
          const tolerance = Math.max(2, Math.round(expectedCount * 0.02));
          check(section, `${key}.geojson 要素数与 meta 一致`, Math.abs(count - expectedCount) <= tolerance,
            { expected: `${expectedCount}（±${tolerance}）`, actual: count, severity: SEVERITY.WARN });
        }
        check(section, `${key}.geojson 要素数 > 0`, count > 0, { expected: '> 0', actual: count });
      }
      record.count = count;
      out.layers.push(record);
    }
  }

  // meta.stats 内部一致性
  if (meta.stats) {
    const buildings = Number(meta.stats.buildings);
    check(section, 'meta.stats.buildings > 1500', buildings > 1500, { expected: '> 1500', actual: buildings });
    check(section, 'meta.stats.roads/landuse/poi > 0',
      Number(meta.stats.roads) > 0 && Number(meta.stats.landuse) > 0 && Number(meta.stats.poi) > 0,
      {
        expected: 'roads/landuse/poi 均 > 0',
        actual: { roads: meta.stats.roads, landuse: meta.stats.landuse, poi: meta.stats.poi },
      });
    const layerCounts = ['roads', 'landuse', 'poi'];
    for (const key of layerCounts) {
      const layerCount = layers[key] && Number(layers[key].count);
      if (Number.isFinite(layerCount)) {
        check(section, `meta.stats.${key} == layers.${key}.count`, Number(meta.stats[key]) === layerCount,
          { expected: layerCount, actual: meta.stats[key], severity: SEVERITY.WARN });
      }
    }
    if (meta.stats.carvedBuildings !== undefined) {
      info(section, '挖空英雄地块建筑数 carvedBuildings', meta.stats.carvedBuildings);
    }
    if (meta.heightModel) {
      info(section, '高度模型', meta.heightModel);
    }
  }

  return out;
}

/* --------------------------------- 主流程 -------------------------------- */
const desktop = {
  load: null,
  state: null,
  data: null,
  artifacts: null,
  bucket: null,
  cameraHashes: {},
};
const mobile = { load: null, state: null, bucket: null };

function addErrorChecks(section, bucket, { fallbackForced }) {
  const filtered = filterExpectedNoise(bucket, fallbackForced);
  check(section, '无 pageerror', filtered.pageErrors.length === 0, {
    expected: 0,
    actual: filtered.pageErrors.length,
    detail: filtered.pageErrors.slice(0, 5),
  });
  check(section, '无 console.error', filtered.consoleErrors.length === 0, {
    expected: 0,
    actual: filtered.consoleErrors.length,
    detail: filtered.consoleErrors.slice(0, 8).map((item) => item.text),
  });
  check(section, '无失败网络请求', filtered.failedRequests.length === 0, {
    expected: 0,
    actual: filtered.failedRequests.length,
    detail: filtered.failedRequests.slice(0, 6),
  });
  if (filtered.abortedRequests && filtered.abortedRequests.length) {
    check(section, '已成功加载但被取消的请求（无头浏览器竞态）', true, {
      severity: SEVERITY.WARN,
      actual: filtered.abortedRequests.length,
      detail: filtered.abortedRequests.slice(0, 6),
    });
  }
  check(section, '无 HTTP 404/5xx', filtered.httpErrors.length === 0, {
    expected: 0,
    actual: filtered.httpErrors.length,
    detail: filtered.httpErrors.slice(0, 8),
  });
  const degradeWarnings = filtered.consoleWarnings.filter((item) => isDegradeWarning(item.text));
  if (fallbackForced) {
    // fallback 场景：契约要求「console.warn 降级、不 console.error」，警告是预期行为
    check(section, 'fallback 降级走 console.warn（非 error）', degradeWarnings.length > 0, {
      expected: '> 0 条降级 warn', actual: degradeWarnings.length, severity: SEVERITY.WARN,
      detail: degradeWarnings.slice(0, 8).map((item) => item.text),
    });
  } else {
    check(section, '无模块降级/加载失败警告', degradeWarnings.length === 0, {
      expected: 0,
      actual: degradeWarnings.length,
      severity: SEVERITY.WARN,
      detail: degradeWarnings.slice(0, 8).map((item) => item.text),
    });
  }
  const reloads = Math.max(0, bucket.loads.length - 1);
  check(section, '测试期间无页面重载（HMR / 文件改动）', reloads === 0, {
    expected: 0,
    actual: reloads,
    severity: SEVERITY.WARN,
    detail: 'Vite 在文件被编辑时会整页 reload；出现重载说明测试期间源码在变，结果可能不稳定。',
  });
}

async function waitForUpgradeReady(page, timeout = 60000) {
  await page.waitForFunction(
    () => Boolean(
      window.__fuhua
      && window.__fuhua.loaded === true
      && window.__upgrade
      && window.__upgrade.ready === true,
    ),
    null,
    { timeout, polling: 100 },
  );
}

async function handleLoadFailure(page, error, bucket, outDir, label, target) {
  const diagnostics = await evalUpgradeState(page).catch(() => null);
  addErrorChecks(`${label}·加载`, bucket, { fallbackForced: OPTIONS.fallback });
  check(`${label}·加载`, `页面就绪（__fuhua.loaded && __upgrade.ready）`, false, {
    expected: 'true',
    actual: diagnostics ? { loaded: diagnostics.fuhuaLoaded, ready: diagnostics.upgradeReady } : '无法读取状态',
    detail: `等待超时 ${error && error.message ? error.message : error}`,
  });
  await page.screenshot({ path: '/tmp/building-atlas-load-failure.png' }).catch(() => {});
  if (!OPTIONS.noShots) {
    await screenshotsImpl(page, outDir, 'upgrade-diagnostic.jpg', { quality: 80 }).catch(() => {});
  }
  if (target) target.load = diagnostics;
  return diagnostics;
}

/* -------------------------------- 桌面验收 ------------------------------- */
async function runDesktop(browser, outDir) {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  });
  if (OPTIONS.fallback) {
    // 模拟数据管线产物缺失：所有 data/site 请求返回 404，验证 city.js 的优雅降级。
    await context.route('**/data/site/**', (route) => route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: '{"error":"forced fallback by verify-upgrade.mjs"}',
    }));
  }
  const page = await context.newPage();
  const bucket = createBucket('desktop');
  attachCollectors(page, bucket);
  desktop.bucket = bucket;
  const section = '桌面';

  const startedAt = Date.now();
  try {
    await page.goto(OPTIONS.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (error) {
    await handleLoadFailure(page, error, bucket, outDir, section, desktop);
    check(section, '页面可访问（DOMContentLoaded）', false, { expected: '加载成功', actual: String(error.message || error) });
    return;
  }

  try {
    await waitForUpgradeReady(page, 60000);
    check(`${section}·加载`, '页面就绪（__fuhua.loaded && __upgrade.ready）', true, {
      expected: 'true', actual: 'true', detail: `${Date.now() - startedAt}ms`,
    });
    desktop.ready = true;
  } catch (error) {
    await handleLoadFailure(page, error, bucket, outDir, section, desktop);
    return;
  }

  // loading 覆盖层隐藏（允许 20s 超时兜底）
  await page.waitForFunction(
    () => document.querySelector('#loading')?.classList.contains('hidden') === true,
    null,
    { timeout: 25000, polling: 120 },
  ).catch(() => {});
  const afterLoad = await evalUpgradeState(page);
  desktop.state = afterLoad;
  check(`${section}·加载`, 'loading 覆盖层已隐藏', afterLoad.loadingHidden === true, {
    expected: 'hidden', actual: afterLoad.loadingHidden, detail: shortValue(afterLoad.loadingText),
  });
  if (!afterLoad.hasCity) {
    note('window.__fuhuaCity 不存在：街区语境模块未加载（城市渲染模块缺失或初始化失败）。');
  }
  if (!afterLoad.hasAtmo) note('window.__upgrade.atmo 不存在：昼夜氛围模块未加载。');
  if (!afterLoad.hasDressing) note('window.__upgrade.dressing 不存在：场地景观模块未加载。');
  await page.waitForTimeout(1200);

  // ---------- 数据 ----------
  const dataState = await evalCityData(page);
  desktop.data = dataState;
  check(`${section}·数据`, 'window.__cityStats 存在', Boolean(dataState.cityStats), {
    expected: '存在', actual: dataState.cityStats ? shortValue(dataState.cityStats) : null,
    detail: afterLoad.hasCity ? null : '街区模块未加载（window.__fuhuaCity 缺失）',
  });

  desktop.staticDeploy = await verifyStaticDeploy(normalizeBaseUrl(OPTIONS.url), `${section}·静态部署`);
  const siteArtifacts = OPTIONS.fallback
    ? { available: false, skipped: '--fallback 强制降级场景，跳过真实数据产物校验' }
    : await verifyDataArtifacts(normalizeBaseUrl(OPTIONS.url), `${section}·数据产物`);
  desktop.artifacts = siteArtifacts;
  const pageFallback = Boolean(
    (dataState.cityStats && dataState.cityStats.fallback)
    || (dataState.cityMeta && dataState.cityMeta.fallback),
  );
  let mode;
  if (OPTIONS.fallback) {
    mode = 'fallback-forced';
  } else if (!dataState.cityStats) {
    mode = 'no-data-no-city';
  } else if (siteArtifacts.available && !pageFallback) {
    mode = 'real';
  } else if (siteArtifacts.available && pageFallback) {
    mode = 'data-present-but-fallback';
  } else if (!siteArtifacts.available && pageFallback) {
    mode = 'data-missing-fallback';
  } else {
    mode = 'unknown';
  }
  desktop.mode = mode;
  shotsEnabled = !OPTIONS.noShots && mode === 'real';
  if (!shotsEnabled && !OPTIONS.noShots) note('非真实数据模式：跳过交付截图（upgrade-*.jpg），仅做降级断言。');
  note(`数据模式：${mode}`);

  check(`${section}·数据`, '街区语境可用（真实数据或 fallback）', dataState.cityStats != null, {
    expected: 'cityStats 存在',
    actual: dataState.cityStats ? mode : null,
    detail: mode === 'no-data-no-city' ? '城市模块缺失且无 fallback' : null,
  });

  if (mode === 'real') {
    const stats = dataState.cityStats || {};
    check(`${section}·数据`, 'buildings > 1500', Number(stats.buildings) > 1500, {
      expected: '> 1500', actual: stats.buildings,
    });
    check(`${section}·数据`, 'roads > 0', Number(stats.roads) > 0, { expected: '> 0', actual: stats.roads });
    check(`${section}·数据`, 'landuse > 0', Number(stats.landuse) > 0, { expected: '> 0', actual: stats.landuse });
    check(`${section}·数据`, 'poi > 0', Number(stats.poi) > 0, { expected: '> 0', actual: stats.poi });
    check(`${section}·数据`, 'window.__cityStats 与 window.__fuhuaCity.data 数量一致',
      dataState.dataCounts.poi === Number(stats.poi || 0)
      && dataState.dataCounts.roads > 0
      && dataState.dataCounts.landuse > 0,
      {
        expected: 'poi == cityStats.poi，roads/landuse > 0',
        actual: { dataCounts: dataState.dataCounts, stats },
        severity: SEVERITY.WARN,
      });
    const metaStats = (dataState.cityMeta && dataState.cityMeta.stats) || {};
    compareCount(`${section}·数据`, 'cityStats.buildings', metaStats.buildings, stats.buildings);
    compareCount(`${section}·数据`, 'cityStats.roads', metaStats.roads, stats.roads);
    compareCount(`${section}·数据`, 'cityStats.landuse', metaStats.landuse, stats.landuse);
    compareCount(`${section}·数据`, 'cityStats.poi', metaStats.poi, stats.poi);

    // 道路朝向
    const orientation = dataState.roadOrientation || {};
    if (orientation['东中街']) {
      check(`${section}·数据`, '道路朝向：东中街在建筑东侧（平均 x > 40）',
        orientation['东中街'].avgX > 40,
        { expected: 'avgX > 40', actual: orientation['东中街'] });
    } else {
      check(`${section}·数据`, '道路朝向：东中街可查', false, { expected: 'name 含「东中街」', actual: null, severity: SEVERITY.WARN });
    }
    if (orientation['东四十条']) {
      check(`${section}·数据`, '道路朝向：东四十条在北侧（平均 z < -40）',
        orientation['东四十条'].avgZ < -40,
        { expected: 'avgZ < -40（北 = -Z）', actual: orientation['东四十条'] });
    } else {
      check(`${section}·数据`, '道路朝向：东四十条可查', false, { expected: 'name 含「东四十条」', actual: null, severity: SEVERITY.WARN });
    }
    if (orientation['东二环']) {
      check(`${section}·数据`, '道路朝向：东二环在西侧（平均 x < -40）',
        orientation['东二环'].avgX < -40,
        { expected: 'avgX < -40（东 = +X）', actual: orientation['东二环'] });
    } else {
      check(`${section}·数据`, '道路朝向：东二环可查', false, { expected: 'name 含「东二环」', actual: null, severity: SEVERITY.WARN });
    }

    // POI 抽样距离
    const poiChecks = [
      ['东四十条地铁站', dataState.poiSample.dongsishitiaoMetro, 300, 380, (ppoi) => String(ppoi.kind || '').includes('metro') || /地铁|站/.test(ppoi.name)],
      ['保利大厦', dataState.poiSample.polyPlaza, 330, 420, null],
      ['首创大厦', dataState.poiSample.capitalBuilding, 90, 140, null],
    ];
    for (const [label, poi, min, max, kindGuard] of poiChecks) {
      if (!poi) {
        check(`${section}·数据`, `POI「${label}」存在`, false, { expected: `name 含「${label}」`, actual: null });
        continue;
      }
      const inRange = poi.distanceM >= min && poi.distanceM <= max;
      check(`${section}·数据`, `POI 距离：${label} ${min}–${max}m`, inRange && (!kindGuard || kindGuard(poi)), {
        expected: `${min}–${max} m`,
        actual: `${poi.name} = ${poi.distanceM}m（x=${poi.x}, z=${poi.z}, kind=${poi.kind}）`,
      });
    }
    if (dataState.poiSample.polyPlaza) {
      check(`${section}·数据`, 'POI 朝向：保利大厦在北侧（z < 0）',
        dataState.poiSample.polyPlaza.z < 0,
        { expected: 'z < 0', actual: dataState.poiSample.polyPlaza });
    }
    const distanceCheck = dataState.poiDistanceConsistent;
    check(`${section}·数据`, '全部 POI distanceM = hypot(x,z)（±1m）', distanceCheck.bad === 0,
      { expected: '0 个不一致', actual: `${distanceCheck.bad}/${distanceCheck.checked}，最大偏差 ${distanceCheck.maxDeviation}m` });

    const covered = dataState.poiNamesCovered;
    check(`${section}·数据`, '契约地标覆盖 ≥ 12 个', covered.length >= 12, {
      expected: '≥ 12 个契约地标',
      actual: `${covered.length} 个：${covered.join('、')}`,
      severity: SEVERITY.WARN,
      detail: dataState.poiNames.length ? `实际 POI：${dataState.poiNames.slice(0, 30).join('、')}` : null,
    });
    info(`${section}·数据`, '道路朝向平均值', orientation);

    // 小地图（真实数据）
    const minimap = dataState.minimap;
    check(`${section}·小地图`, '#context-map svg 存在', Boolean(minimap), { expected: '存在 SVG', actual: minimap });
    if (minimap) {
      const minimapTotal = minimap.paths + minimap.polylines + minimap.polygons
        + minimap.lines + minimap.circles + minimap.texts;
      check(`${section}·小地图`, 'SVG 图形元素合计 > 20（path/polyline/polygon/line/circle/text）', minimapTotal > 20, {
        expected: '> 20（Lead 2026-11-04 放宽口径）', actual: { total: minimapTotal, ...minimap },
      });
      // Lead 验收口径要求「path/polyline 数 > 20」；当前 minimap 实现把同档路网合并为单个 path
      //（性能考量），因此按严格口径记 warning，并把元素构成写进报告供 Lead 决策。
      check(`${section}·小地图`, 'SVG path/polyline 数 > 20（严格口径）', minimap.paths + minimap.polylines > 20, {
        expected: '> 20', actual: { paths: minimap.paths, polylines: minimap.polylines, circles: minimap.circles },
        severity: SEVERITY.WARN,
        detail: 'minimap.js 将路网按 4 档合并为 4 个 path，另有绿地/地块/中心/t 比例尺/指北针 path；POI 用 circle 表示。',
      });
      info(`${section}·小地图`, 'SVG 元素统计', minimap);
    }
    // 数值 UI 文案
    if (!pageFallback) {
      check(`${section}·数据`, '#stat-buildings 文案含白模栋数', /1[,，]?766/.test(dataState.statBuildings), {
        expected: '1,766', actual: dataState.statBuildings, severity: SEVERITY.WARN,
      });
      check(`${section}·数据`, '#context-range 文案含覆盖半径 1.5 km', /1\.5\s*km/.test(dataState.contextRange) && /1[,，]?766/.test(dataState.contextRange), {
        expected: '1.5 km + 1,766 栋', actual: dataState.contextRange, severity: SEVERITY.WARN,
      });
    }
  } else if (mode === 'fallback-forced' || mode === 'data-missing-fallback') {
    const stats = dataState.cityStats || {};
    check(`${section}·fallback`, 'fallback 生效（cityStats.fallback === true）', Boolean(stats.fallback), {
      expected: true, actual: stats.fallback,
    });
    check(`${section}·fallback`, 'fallback 白模数量合理（1–200）',
      Number(stats.buildings) > 0 && Number(stats.buildings) <= 200,
      { expected: '1–200', actual: stats.buildings });
    check(`${section}·fallback`, 'fallback 后 loading 覆盖层正常隐藏', afterLoad.loadingHidden === true, {
      expected: true, actual: afterLoad.loadingHidden,
    });
    check(`${section}·fallback`, 'fallback 小地图或提示已渲染',
      Boolean(dataState.minimap) || Boolean(await textOf(page, '#context-map')),
      { expected: 'SVG 或文字提示', actual: dataState.minimap ? 'SVG' : shortValue(await textOf(page, '#context-map')) });
    check(`${section}·fallback`, 'fallback 地标列表/提示已渲染', (await page.locator('#landmark-list').count()) > 0, {
      expected: '列表或空态提示', actual: shortValue(await textOf(page, '#landmark-list')),
    });
    note('fallback 模式：跳过真实数据（buildings>1500 / GLB / 朝向 / POI 距离）断言。');
  } else if (mode === 'data-present-but-fallback') {
    check(`${section}·数据`, '真实数据已产出但页面走 fallback（不应发生）', false, {
      expected: '真实数据渲染',
      actual: '页面 fallback',
      detail: 'meta.json 可访问，但 cityStats.fallback=true：检查 GLB 解析失败或 fetch 失败原因。',
    });
    check(`${section}·fallback`, 'fallback 生效（cityStats.fallback === true）',
      Boolean(dataState.cityStats && dataState.cityStats.fallback), { expected: true, actual: dataState.cityStats && dataState.cityStats.fallback });
  } else {
    check(`${section}·数据`, '街区语境模块加载（city.js 入口存在且初始化成功）', false, {
      expected: 'window.__fuhuaCity 存在',
      actual: { hasCity: afterLoad.hasCity, cityStats: dataState.cityStats, statusText: afterLoad.statusText },
      detail: '城市渲染模块缺失/失败，且未进入 fallback。',
    });
  }

  // ---------- 模块契约 API / 输出细节 ----------
  if (afterLoad.hasCity) {
    const requiredCityApi = ['setLayer', 'toggleLayer', 'setAllVisible', 'setNight', 'setHighlightSite', 'update', 'minimapSvg', 'poisWithin', 'dispose'];
    const missingCityApi = dataState.cityMissingApi || requiredCityApi;
    check(`${section}·模块契约`, 'city API 齐全（契约 §3）', missingCityApi.length === 0, {
      expected: requiredCityApi.join(' / '),
      actual: missingCityApi.length ? `缺少：${missingCityApi.join(' / ')}` : '齐全',
      severity: SEVERITY.WARN,
      detail: `prototype 方法：${(dataState.cityApi || []).join(' / ')}`,
    });
    check(`${section}·模块契约`, 'city.data.byName 为 Map（契约 §3）', dataState.byNameIsMap === true, {
      expected: 'Map', actual: dataState.byNameIsMap ? `Map(${dataState.byNameSize})` : dataState.byNameIsMap,
      severity: SEVERITY.WARN,
    });
    const atmoApi = dataState.atmoApi || [];
    const requiredAtmoApi = ['setPreset', 'cyclePreset', 'setModel', 'setShadows', 'update', 'render', 'resize'];
    const missingAtmoApi = requiredAtmoApi.filter((fn) => !atmoApi.includes(fn));
    check(`${section}·模块契约`, 'atmosphere API 齐全（契约 §4.1）', Boolean(dataState.atmo) && missingAtmoApi.length === 0, {
      expected: requiredAtmoApi.join(' / '),
      actual: dataState.atmo ? (missingAtmoApi.length ? `缺少：${missingAtmoApi.join(' / ')}` : '齐全') : 'atmo 未加载',
      severity: SEVERITY.WARN,
      detail: dataState.atmo ? shortValue(dataState.atmo) : null,
    });
    const dressingApi = dataState.dressingApi || [];
    const requiredDressingApi = ['update', 'setNight', 'setLayer'];
    const missingDressingApi = requiredDressingApi.filter((fn) => !dressingApi.includes(fn));
    check(`${section}·模块契约`, 'site-dressing API 齐全（契约 §4.2）', Boolean(dataState.dressing) && missingDressingApi.length === 0, {
      expected: requiredDressingApi.join(' / ') + ' + group/layers/stats',
      actual: dataState.dressing ? (missingDressingApi.length ? `缺少：${missingDressingApi.join(' / ')}` : '齐全') : 'dressing 未加载',
      severity: SEVERITY.WARN,
      detail: dataState.dressing ? shortValue(dataState.dressing) : null,
    });
    const labelTotal = dataState.cityLabelCount || 0;
    const labelVisible = dataState.cityLabelVisibleCount || 0;
    if (pageFallback) {
      info(`${section}·数据`, 'fallback 模式城市标签', { total: labelTotal, visible: labelVisible });
    } else {
      check(`${section}·数据`, '城市 POI DOM 标签 1–16 个（契约 §3）', labelTotal > 0 && labelTotal <= 16 && labelVisible > 0, {
        expected: '1–16（含隐藏槽位）且可见 > 0',
        actual: { total: labelTotal, visible: labelVisible, ringLabels: dataState.cityRingLabelCount },
        severity: SEVERITY.WARN,
        detail: `可见标签：${(dataState.cityLabelTexts || []).join(' / ')}`,
      });
      check(`${section}·数据`, '#city-labels 容器可见且有子节点', dataState.cityLabelsVisible === true, {
        expected: true, actual: dataState.cityLabelsVisible, severity: SEVERITY.WARN,
      });
    }
    if (dataState.cityStats && dataState.cityStats.labels !== undefined) {
      info(`${section}·数据`, '城市标签数量（city.stats.labels）', dataState.cityStats.labels);
    }
    if (dataState.dressing && dataState.dressing.stats) {
      info(`${section}·数据`, '场地景置统计', dataState.dressing.stats);
      if (dataState.dressing.stats.blades === 0) {
        note('场地景置 stats.blades=0：旗帜/标识层未统计到叶片（契约 §4.2 建议入口旗杆 + 旗帜动画，属可选视觉项，供 Lead 判断）。');
      }
    }
  }
  // 氛围模块：composer / 天空 / 灯光接管
  if (afterLoad.hasAtmo) {
    check(`${section}·模块契约`, 'atmosphere 后处理 composer 存在（契约 §4.1）', Boolean(dataState.atmo && dataState.atmo.hasComposer), {
      expected: true, actual: dataState.atmo, severity: SEVERITY.WARN,
    });
    check(`${section}·模块契约`, 'atmosphere 自定义天空 / 灯光接管', Boolean(dataState.atmo && dataState.atmo.hasSky && dataState.atmo.hasSun), {
      expected: 'sky + sun', actual: dataState.atmo, severity: SEVERITY.WARN,
    });
    info(`${section}·模块契约`, 'window.__atmo / window.__dressing 调试句柄', {
      atmo: Boolean(await page.evaluate(() => Boolean(window.__atmo))),
      dressing: Boolean(await page.evaluate(() => Boolean(window.__dressing))),
    });
  }

  // 英雄模型未回归（契约 §0：48 mesh / 202,728 三角面）
  if (dataState.sceneStats && dataState.sceneStats.loaded) {
    check(`${section}·模块契约`, '英雄 GLB 未回归（48 mesh / 202,728 三角面）',
      Number(dataState.sceneStats.meshes) === 48 && Number(dataState.sceneStats.triangles) === 202728, {
        expected: { meshes: 48, triangles: 202728 },
        actual: { meshes: dataState.sceneStats.meshes, triangles: dataState.sceneStats.triangles },
        severity: SEVERITY.WARN,
      });
  }
  // EffectComposer 下 main.js 的 __renderInfo 只反映最后一个 pass 的 renderer.info
  if (dataState.renderInfo && Number(dataState.renderInfo.calls) <= 2) {
    note(`window.__renderInfo=${shortValue(dataState.renderInfo)}：atmo 使用 EffectComposer 后，main.js 读取的 renderer.info 只反映最后一个全屏 pass（calls/triangles≈1），不代表整帧 draw calls；fps 口径不受影响（fps=${dataState.fps}）。`);
  }

  // ---------- 截图：日景（默认视角） ----------
  // 测试期间把页面拉回 day + perspective 起始态
  const resetToDay = async () => {
    try {
      const time = await page.evaluate(() => window.__fuhua && window.__fuhua.time);
      if (time && time !== 'day') {
        await page.evaluate(() => window.__upgrade && window.__upgrade.setTime && window.__upgrade.setTime('day'));
      }
      await page.evaluate(() => window.__fuhua && window.__fuhua.setView && window.__fuhua.setView('perspective'));
    } catch { /* 忽略 */ }
    await page.waitForTimeout(1800);
  };
  await resetToDay();
  await page.waitForTimeout(600);

  if ((await page.evaluate(() => window.__fuhua && window.__fuhua.time)) === 'day') {
    await screenshotsImpl(page, outDir, 'upgrade-day.jpg');
  } else {
    check(`${section}·截图`, '默认视角为日景', false, { expected: 'day', actual: await page.evaluate(() => window.__fuhua && window.__fuhua.time), severity: SEVERITY.WARN });
  }

  // ---------- 时间三态 ----------
  const timeSection = `${section}·时间`;
  const initialTime = await page.evaluate(() => window.__fuhua && window.__fuhua.time);
  check(timeSection, '初始时间为 day', initialTime === 'day', { expected: 'day', actual: initialTime });
  try {
    await click(page, '#night');
    await waitForTime(page, 'dusk', 6000);
    await page.waitForTimeout(1600);
    const duskTime = await page.evaluate(() => window.__fuhua && window.__fuhua.time);
    const duskState = await page.evaluate(() => ({
      atmo: window.__upgrade && window.__upgrade.atmo ? window.__upgrade.atmo.preset : null,
      label: document.querySelector('#night')?.textContent?.trim() || '',
    }));
    check(timeSection, '第一次点击 → 黄昏（dusk）', duskTime === 'dusk' && duskState.atmo === 'dusk', {
      expected: 'dusk', actual: { time: duskTime, atmo: duskState.atmo, button: shortValue(duskState.label) },
    });
    await screenshotsImpl(page, outDir, 'upgrade-dusk.jpg');

    await click(page, '#night');
    await waitForTime(page, 'night', 6000);
    await page.waitForTimeout(1600);
    const nightTime = await page.evaluate(() => window.__fuhua && window.__fuhua.time);
    const nightState = await page.evaluate(() => ({
      atmo: window.__upgrade && window.__upgrade.atmo ? window.__upgrade.atmo.preset : null,
      bodyNight: document.body.classList.contains('is-night'),
      aria: document.querySelector('#night')?.getAttribute('aria-pressed'),
    }));
    check(timeSection, '第二次点击 → 夜景（night）', nightTime === 'night' && nightState.atmo === 'night' && nightState.bodyNight === true, {
      expected: 'night + body.is-night', actual: { time: nightTime, atmo: nightState.atmo, bodyNight: nightState.bodyNight, aria: nightState.aria },
    });
    await screenshotsImpl(page, outDir, 'upgrade-night.jpg');

    await click(page, '#night');
    await waitForTime(page, 'day', 6000);
    await page.waitForTimeout(1200);
    const backToDay = await page.evaluate(() => window.__fuhua && window.__fuhua.time);
    check(timeSection, '第三次点击 → 回到日景（day）', backToDay === 'day', { expected: 'day', actual: backToDay });
  } catch (error) {
    check(timeSection, '三态时间切换链路', false, { expected: 'day→dusk→night→day', actual: String(error.message || error) });
  }

  // ---------- 图层开关 ----------
  const layerSection = `${section}·图层`;
  const readLayers = async () => page.evaluate(() => {
    const layers = window.__upgrade && window.__upgrade.layers;
    return layers ? { ...layers } : null;
  });
  const layerButtonPressed = async (name) => {
    try {
      return await page.locator(`[data-layer="${name}"]`).first().getAttribute('aria-pressed', { timeout: 2000 });
    } catch {
      return null;
    }
  };
  /** 读取图层值：优先 city.layers，trees/lamps 走 dressing.layers。 */
  const readLayerValue = async (name) => page.evaluate((key) => {
    const layers = window.__upgrade && window.__upgrade.layers;
    if (layers && key in layers) return { value: layers[key], source: 'city' };
    const dressingLayers = window.__upgrade && window.__upgrade.dressing && window.__upgrade.dressing.layers;
    if (dressingLayers && key in dressingLayers) return { value: dressingLayers[key], source: 'dressing' };
    return null;
  }, name);
  const ensureLayerPanel = async () => {
    const open = await page.evaluate(() => {
      const panel = document.querySelector('#layers-panel');
      return panel ? panel.hidden === false : false;
    });
    if (!open) {
      await click(page, '#layers-toggle');
      await page.waitForTimeout(300);
    }
  };
  const toggleLayerCheck = async (name, { severity = SEVERITY.FAIL } = {}) => {
    await ensureLayerPanel();
    const before = await readLayerValue(name);
    if (!before) {
      check(layerSection, `图层开关 ${name}`, false, { expected: 'city/dressing.layers 中存在该图层', actual: null, severity });
      return;
    }
    const initial = Boolean(before.value);
    await click(page, `[data-layer="${name}"]`);
    await page.waitForTimeout(350);
    const afterFlip = await readLayerValue(name);
    const pressedFlip = await layerButtonPressed(name);
    await click(page, `[data-layer="${name}"]`);
    await page.waitForTimeout(350);
    const afterRestore = await readLayerValue(name);
    const pressedRestore = await layerButtonPressed(name);
    const flipped = Boolean(afterFlip && Boolean(afterFlip.value) !== initial);
    const restored = Boolean(afterRestore && Boolean(afterRestore.value) === initial);
    const pressedOk = pressedFlip === String(!initial) && pressedRestore === String(initial);
    check(layerSection, `图层开关 ${name}（${initial ? '开' : '关'} → ${initial ? '关' : '开'} → 恢复）`, flipped && restored && pressedOk, {
      expected: `${name}: ${initial} → ${!initial} → ${initial}，aria-pressed 同步`,
      actual: {
        before: initial,
        flip: afterFlip && afterFlip.value,
        restore: afterRestore && afterRestore.value,
        ariaFlip: pressedFlip,
        ariaRestore: pressedRestore,
        source: before.source,
      },
      severity,
    });
  };
  try {
    const panelOpen = await page.evaluate(() => {
      const panel = document.querySelector('#layers-panel');
      return panel ? panel.hidden === false : false;
    });
    if (!panelOpen) await click(page, '#layers-toggle');
    await page.waitForTimeout(300);
    const panelVisible = await isVisible(page, '#layers-panel');
    check(layerSection, '图层面板可展开', panelVisible, { expected: 'visible', actual: panelVisible });
    // 必测三图层（Lead 验收口径）：whiteModels / roads / poi
    for (const name of ['whiteModels', 'roads', 'poi']) {
      await toggleLayerCheck(name);
    }
    // 其余契约图层（landuse/site/rings/trees/lamps）记为 warning，避免单点问题阻断整体验收
    for (const name of ['landuse', 'site', 'rings', 'trees', 'lamps']) {
      try {
        await toggleLayerCheck(name, { severity: SEVERITY.WARN });
      } catch (error) {
        check(layerSection, `图层开关 ${name}`, false, { expected: '可切换', actual: String(error.message || error), severity: SEVERITY.WARN });
      }
    }
    await click(page, '#layers-close').catch(() => {});
  } catch (error) {
    check(layerSection, '图层开关链路', false, { expected: '可切换', actual: String(error.message || error) });
  }

  // ---------- 街区视角 ----------
  const viewSection = `${section}·视角`;
  try {
    await page.evaluate(() => window.__upgrade && window.__upgrade.setTime && window.__upgrade.setTime('day'));
    await page.waitForTimeout(800);
    await click(page, '[data-view="city"]');
    await page.waitForFunction(
      () => (document.querySelector('#view-name')?.textContent || '').includes('街区鸟瞰'),
      null,
      { timeout: 10000, polling: 100 },
    );
    await page.waitForTimeout(2200);
    const viewState = await page.evaluate(() => ({
      viewName: document.querySelector('#view-name')?.textContent?.trim() || '',
      cityVisible: window.__upgrade && window.__upgrade.city && window.__upgrade.city.group ? window.__upgrade.city.group.visible : null,
      navActive: document.querySelector('#nav-context')?.classList.contains('active') || false,
    }));
    check(viewSection, '点击「街区鸟瞰」→ #view-name 更新', viewState.viewName.includes('街区鸟瞰'), {
      expected: '街区鸟瞰', actual: viewState.viewName,
    });
    check(viewSection, '街区鸟瞰时城市图层可见', viewState.cityVisible === true, {
      expected: true, actual: viewState.cityVisible,
    });
    check(viewSection, '街区语境导航态高亮', viewState.navActive === true, { expected: true, actual: viewState.navActive, severity: SEVERITY.WARN });
    await screenshotsImpl(page, outDir, 'upgrade-city.jpg');
  } catch (error) {
    check(viewSection, '街区鸟瞰视角切换', false, { expected: '正常切换', actual: String(error.message || error) });
  }

  // ---------- POI 点击飞行 ----------
  const poiSection = `${section}·地标`;
  try {
    const poiCount = await page.locator('#landmark-list button').count();
    check(poiSection, '地标列表非空', poiCount > 0, { expected: '> 0', actual: poiCount });
    if (poiCount > 0) {
      const beforeHash = await canvasHash(page);
      const beforeView = await textOf(page, '#view-name');
      const firstName = (await textOf(page, '#landmark-list button .lm-name')).split('\n')[0] || '';
      await page.locator('#landmark-list button').first().click();
      await page.waitForTimeout(2000);
      const detail = await textOf(page, '#poi-detail');
      const viewName = await textOf(page, '#view-name');
      const activeCount = await page.evaluate(() => document.querySelectorAll('#landmark-list button.active').length);
      const afterHash = await canvasHash(page);
      const cameraChanged = Boolean(beforeHash && afterHash && beforeHash !== afterHash);
      check(poiSection, '点击地标 → #poi-detail 非空', detail.length > 0 && !detail.includes('点选地标'), {
        expected: '显示地标详情', actual: shortValue(detail),
      });
      check(poiSection, '点击地标 → 视角名切换为「周边地标」', viewName.includes('周边地标'), {
        expected: '含「周边地标」', actual: viewName,
      });
      check(poiSection, '点击地标 → 相机画面变化（canvas 哈希）', cameraChanged, {
        expected: '画面变化（focusPoi → fly）',
        actual: cameraChanged ? 'changed' : 'unchanged',
        detail: `before="${beforeView}" firstName="${firstName}" hashBefore=${beforeHash || 'n/a'} hashAfter=${afterHash || 'n/a'}`,
        severity: SEVERITY.WARN,
      });
      check(poiSection, '点击地标 → 列表项高亮一项', activeCount === 1, { expected: 1, actual: activeCount, severity: SEVERITY.WARN });
      info(poiSection, '首个地标信息', { name: firstName, detail: shortValue(detail, 300) });

      // 3D 城市标签点击（契约 §3：city 标签点击回调 onPoiClick）
      const labelCount = await page.locator('#city-labels .city-poi').count();
      if (labelCount > 0) {
        const clicked = await page.evaluate(() => {
          const el = [...document.querySelectorAll('#city-labels .city-poi')].find((node) => !node.hidden && (node.textContent || '').trim());
          if (!el) return null;
          const text = (el.textContent || '').trim();
          const name = text.replace(/\s*\d+(?:\.\d+)?\s*m$/i, '').trim();
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          return { text, name };
        });
        await page.waitForTimeout(1500);
        const textAfter = await textOf(page, '#poi-detail');
        check(poiSection, '点击 3D 城市标签 → onPoiClick / poi-detail 更新',
          Boolean(clicked) && textAfter.length > 0 && (!clicked.name || textAfter.includes(clicked.name) || textAfter.includes(clicked.text)),
          { expected: `详情包含「${clicked ? clicked.name : '标签名称'}」`, actual: shortValue(textAfter), severity: SEVERITY.WARN });
      }
      // 小地图 POI 点击（contract：minimap 点出地铁/地标，main 绑定点击飞行）
      const mapPoi = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('#context-map [data-poi-id]')];
        if (!nodes.length) return null;
        const active = document.querySelector('#landmark-list button.active')?.dataset.poiId || null;
        const target = nodes.find((node) => node.dataset.poiId !== active) || nodes[0];
        const id = target.dataset.poiId;
        const title = target.querySelector('title')?.textContent
          || target.parentElement?.querySelector('title')?.textContent
          || (target.closest('g')?.querySelector('title')?.textContent)
          || '';
        const name = String(title).replace(/\s*\d+(?:\.\d+)?\s*m$/i, '').trim();
        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return { id, name };
      });
      if (mapPoi) {
        await page.waitForTimeout(1600);
        const afterView = await textOf(page, '#view-name');
        const afterDetail = await textOf(page, '#poi-detail');
        check(poiSection, '点击小地图 POI → 相机飞行 / 详情更新',
          afterView.includes('周边地标') && (!mapPoi.name || afterDetail.includes(mapPoi.name)),
          { expected: 'view-name 含「周边地标」且详情对应小地图 POI', actual: { view: afterView, detail: shortValue(afterDetail) }, severity: SEVERITY.WARN });
      }
    }
  } catch (error) {
    check(poiSection, 'POI 点击飞行链路', false, { expected: '正常飞行', actual: String(error.message || error) });
  }

  // ---------- 楼层模式 ----------
  const floorSection = `${section}·楼层`;
  try {
    await click(page, '#nav-floors');
    await page.waitForFunction(
      () => window.__fuhuaFloor && window.__fuhuaFloor.state && window.__fuhuaFloor.state.active === true,
      null,
      { timeout: 30000, polling: 120 },
    );
    await page.waitForTimeout(400);
    const floorPanelVisible = await isVisible(page, '#floor-panel');
    const levelFirst = await page.evaluate(() => window.__fuhuaFloor.state);
    check(floorSection, '进入楼层模式（active + .floor-panel 可见）', levelFirst.active === true && floorPanelVisible, {
      expected: { active: true, panel: 'visible' }, actual: { active: levelFirst.active, panel: floorPanelVisible },
    });
    // 选 F 座 L9（若层数不足则取最接近的）
    await page.evaluate(() => { window.__fuhuaFloor.selectTower('F'); });
    await page.waitForFunction(() => window.__fuhuaFloor.busy === false, null, { timeout: 20000, polling: 150 }).catch(() => {});
    await page.waitForTimeout(600);
    const requestedIndex = await page.evaluate(() => {
      const api = window.__fuhuaFloor;
      const target = Math.min(8, api.state.levels - 1);
      api.selectLevel(target);
      return target;
    });
    await page.waitForFunction(() => window.__fuhuaFloor.busy === false, null, { timeout: 20000, polling: 150 }).catch(() => {});
    await page.waitForTimeout(1000);
    const floorState = await page.evaluate(() => ({
      ...window.__fuhuaFloor.state,
      busy: window.__fuhuaFloor.busy,
      floorMeta: document.querySelector('#floor-meta')?.textContent?.trim() || '',
      floorCurrent: document.querySelector('#floor-current')?.textContent?.trim() || '',
      planUnits: document.querySelectorAll('#layout-svg .plan-unit').length,
      floorTagVisible: document.body.classList.contains('floor-mode'),
      cityVisible: window.__upgrade && window.__upgrade.city && window.__upgrade.city.group ? window.__upgrade.city.group.visible : null,
      dressingVisible: window.__upgrade && window.__upgrade.dressing && window.__upgrade.dressing.group ? window.__upgrade.dressing.group.visible : null,
      cityLabelsDisplay: document.querySelector('#city-labels') ? window.getComputedStyle(document.querySelector('#city-labels')).display : null,
    }));
    check(floorSection, '选中 F 座楼层（L9 或最接近层）', floorState.tower === 'F' && floorState.level === requestedIndex, {
      expected: `F 座 + index ${requestedIndex}（L9 优先）`,
      actual: { tower: floorState.tower, level: floorState.level, label: floorState.levelLabel, requested: requestedIndex },
    });
    check(floorSection, '楼层标题/标签同步', /F\s*座/.test(floorState.floorMeta) && Boolean(floorState.floorCurrent), {
      expected: 'F 座 + 当前层号', actual: { meta: shortValue(floorState.floorMeta), current: floorState.floorCurrent },
      severity: SEVERITY.WARN,
    });
    check(floorSection, '2D 平面分区渲染', floorState.planUnits > 0, { expected: '> 0 plan-unit', actual: floorState.planUnits });
    check(floorSection, '楼层模式下城市/场地隐藏', floorState.cityVisible === false && floorState.dressingVisible !== true, {
      expected: 'city.visible=false / dressing=false', actual: { cityVisible: floorState.cityVisible, dressingVisible: floorState.dressingVisible },
    });
    await screenshotsImpl(page, outDir, 'upgrade-floors.jpg');
    info(floorSection, '楼层状态', floorState);

    // 退出恢复
    await click(page, '#floor-exit');
    await page.waitForFunction(
      () => window.__fuhuaFloor.state.active === false,
      null,
      { timeout: 20000, polling: 120 },
    );
    await page.waitForFunction(() => window.__fuhuaFloor.busy === false, null, { timeout: 20000, polling: 150 }).catch(() => {});
    await page.waitForTimeout(1200);
    const exitState = await page.evaluate(() => ({
      active: window.__fuhuaFloor.state.active,
      floorPanelHidden: document.querySelector('#floor-panel')?.hidden,
      bodyFloorMode: document.body.classList.contains('floor-mode'),
      cityVisible: window.__upgrade && window.__upgrade.city && window.__upgrade.city.group ? window.__upgrade.city.group.visible : null,
      dressingVisible: window.__upgrade && window.__upgrade.dressing && window.__upgrade.dressing.group ? window.__upgrade.dressing.group.visible : null,
      labelsDisplay: document.querySelector('#city-labels') ? window.getComputedStyle(document.querySelector('#city-labels')).display : null,
    }));
    check(floorSection, '退出楼层模式并恢复整体模式', exitState.active === false && exitState.floorPanelHidden === true && exitState.bodyFloorMode === false, {
      expected: 'active=false / panel hidden / body 无 floor-mode', actual: exitState,
    });
    check(floorSection, '退出后城市/场地恢复可见', exitState.cityVisible !== false && exitState.dressingVisible !== false && exitState.labelsDisplay !== 'none', {
      expected: '城市/场地/labels 恢复', actual: exitState, severity: SEVERITY.WARN,
    });
  } catch (error) {
    check(floorSection, '楼层模式进出链路', false, { expected: '正常进出', actual: String(error.message || error) });
    // 尝试恢复
    await page.evaluate(() => { try { window.__fuhuaFloor.exit(); } catch { /* ignore */ } }).catch(() => {});
    await page.waitForTimeout(800);
  }

  // ---------- 小地图（兜底：若真实数据分支已测过则跳过重复） ----------
  if (mode !== 'real') {
    const minimap = await page.evaluate(() => {
      const svg = document.querySelector('#context-map svg');
      return svg ? { paths: svg.querySelectorAll('path').length, polylines: svg.querySelectorAll('polyline').length, lines: svg.querySelectorAll('line').length } : null;
    });
    check(`${section}·小地图`, '#context-map 有内容', Boolean(minimap) || (await page.locator('#context-map').count()) > 0, {
      expected: 'SVG 或降级提示', actual: minimap ? { paths: minimap.paths, polylines: minimap.polylines } : 'text fallback',
      severity: SEVERITY.WARN,
    });
  }

  // ---------- OSM 署名（信息项，footer 由 Lead 负责） ----------
  const footerText = await textOf(page, 'footer');
  check(`${section}·署名`, 'footer 含 OpenStreetMap / ODbL 署名（信息项）',
    /openstreetmap/i.test(footerText) && /odb[l|1]/i.test(footerText),
    { expected: 'OpenStreetMap + ODbL', actual: shortValue(footerText), severity: SEVERITY.INFO });
  info(`${section}·署名`, 'footer 文本', shortValue(footerText, 400));

  // ---------- 性能采样 ----------
  const perfSection = `${section}·性能`;
  try {
    await page.evaluate(() => window.__upgrade && window.__upgrade.setTime && window.__upgrade.setTime('day'));
    await page.evaluate(() => window.__fuhua && window.__fuhua.setView && window.__fuhua.setView('perspective'));
    await page.waitForTimeout(3200);
    const perf = await page.evaluate(() => {
      const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };
      return {
        fps: safe(() => window.__fps || null),
        renderInfo: safe(() => window.__renderInfo || null),
        cityStats: safe(() => window.__cityStats || null),
        cityStatsFull: safe(() => (window.__upgrade.city ? window.__upgrade.city.stats : null)),
        dressingStats: safe(() => (window.__upgrade.dressing ? window.__upgrade.dressing.stats : null)),
        sceneStats: safe(() => window.__sceneStats || null),
        atmoPreset: safe(() => (window.__upgrade.atmo ? window.__upgrade.atmo.preset : null)),
      };
    });
    desktop.performance = perf;
    const fps = Number(perf.fps);
    if (Number.isFinite(fps) && fps > 0) {
      check(perfSection, 'fps ≥ 30（GPU 无头）', fps >= 30, {
        expected: '≥ 30（契约目标 ≥ 45）',
        actual: `${fps} fps`,
        severity: SEVERITY.WARN,
        detail: fps >= 45 ? '达到契约 45fps 目标' : fps >= 30 ? '低于契约目标 45fps，请关注' : '明显卡顿',
      });
      if (fps < 45) note(`性能：fps=${fps}，低于契约目标 45fps（不直接 fail，报告说明）。`);
    } else {
      check(perfSection, '可读取 window.__fps', false, { expected: '数值', actual: perf.fps, severity: SEVERITY.WARN });
    }
    const drawCalls = perf.renderInfo && perf.renderInfo.calls;
    const triangles = perf.renderInfo && perf.renderInfo.triangles;
    info(perfSection, '渲染采样', { fps: perf.fps, drawCalls, triangles, renderInfo: perf.renderInfo });
    if (perf.cityStatsFull && Number.isFinite(Number(perf.cityStatsFull.drawCalls))) {
      // 契约 §3（2026-11-04 修订）：白模理想 ≤4；整个 city group 目标 ≤12（实测 11 可接受）
      check(perfSection, 'city group drawCalls ≤ 12（契约 §3 修订口径）', Number(perf.cityStatsFull.drawCalls) <= 12, {
        expected: '≤ 12（白模理想 ≤4）', actual: perf.cityStatsFull.drawCalls, severity: SEVERITY.WARN,
        detail: 'Lead 2026-11-04 决策：城市总 draw call 11 记 PASS，不阻断。',
      });
    }
    if (perf.cityStatsFull && Number.isFinite(Number(perf.cityStatsFull.triangles))) {
      check(perfSection, 'city 模块三角面 < 200k', Number(perf.cityStatsFull.triangles) < 200000, {
        expected: '< 200000', actual: perf.cityStatsFull.triangles, severity: SEVERITY.WARN,
      });
    }
    if (perf.dressingStats && Number.isFinite(Number(perf.dressingStats.drawCalls))) {
      check(perfSection, '场地景置 drawCalls ≤ 30', Number(perf.dressingStats.drawCalls) <= 30, {
        expected: '≤ 30', actual: perf.dressingStats.drawCalls, severity: SEVERITY.WARN,
      });
    }
    if (perf.dressingStats && Number.isFinite(Number(perf.dressingStats.triangles))) {
      check(perfSection, '场地景置三角面 < 80k', Number(perf.dressingStats.triangles) < 80000, {
        expected: '< 80000', actual: perf.dressingStats.triangles, severity: SEVERITY.WARN,
      });
    }
    info(perfSection, '模块统计', { city: perf.cityStatsFull, dressing: perf.dressingStats, scene: perf.sceneStats });
  } catch (error) {
    check(perfSection, '性能采样', false, { expected: '可读取', actual: String(error.message || error), severity: SEVERITY.WARN });
  }

  // ---------- 封面构图 ----------
  try {
    await freshCover(page, outDir);
  } catch (error) {
    check(`${section}·截图`, '封面构图截图', false, { expected: '生成 upgrade-cover.jpg', actual: String(error.message || error), severity: SEVERITY.WARN });
  }

  // ---------- 归拢运行时错误 ----------
  addErrorChecks(`${section}·运行时`, bucket, { fallbackForced: OPTIONS.fallback });
  info(`${section}·运行时`, 'console.warning（原始）', bucket.consoleWarnings.slice(0, 20).map((item) => item.text));
  info(`${section}·运行时`, 'HTTP 响应统计', summarizeResponses(bucket));
  info(`${section}·运行时`, '页面状态', afterLoad);
  info(`${section}·运行时`, '城市数据摘要', dataState);
  desktop.loadDurationMs = Date.now() - startedAt;

  await context.close();
}

function summarizeResponses(bucket) {
  const byStatus = {};
  for (const response of bucket.responses) {
    byStatus[response.status] = (byStatus[response.status] || 0) + 1;
  }
  return byStatus;
}

async function freshCover(page, outDir) {
  // 日景 + 45° 西南视角（角度略拉远，让周边白模/街区语境进入画面），等飞行结束后截图。
  await page.evaluate(() => {
    try {
      window.__upgrade.setTime && window.__upgrade.setTime('day');
      window.__fuhua.setView && window.__fuhua.setView('perspective');
    } catch { /* ignore */ }
  });
  await page.waitForTimeout(1800);
  const canvas = page.locator('#viewport canvas').first();
  const box = await canvas.boundingBox().catch(() => null);
  if (box) {
    // 滚轮轻微拉远（约 5–8%），把街区白模带入构图同时保留建筑主体
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(1100);
  }
  if (!shotsEnabled) return;
  // 候选留档到 /tmp，便于人工挑图后覆盖（脚本默认写 cover 成品）
  const candidateDir = '/tmp/building-atlas-cover-candidates';
  fs.mkdirSync(candidateDir, { recursive: true });
  await page.screenshot({ path: path.join(candidateDir, 'cover-perspective-45.jpg'), type: 'jpeg', quality: 90 });

  // 候选 2：街区鸟瞰
  await page.evaluate(() => { try { window.__fuhua.setView('city'); } catch { /* ignore */ } });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(candidateDir, 'cover-city-aerial.jpg'), type: 'jpeg', quality: 90 });

  // 最终默认：回到 45° 西南视角拉远构图（封面以建筑主体为主，兼顾街区语境）
  await page.evaluate(() => { try { window.__fuhua.setView('perspective'); } catch { /* ignore */ } });
  await page.waitForTimeout(1800);
  await page.mouse.move((box ? box.x + box.width * 0.5 : 800), (box ? box.y + box.height * 0.5 : 500));
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(1100);
  await screenshotsImpl(page, outDir, 'upgrade-cover.jpg', { quality: 90 });
}

/* -------------------------------- 移动端验收 ------------------------------ */
async function runMobile(browser, outDir) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  });
  if (OPTIONS.fallback) {
    await context.route('**/data/site/**', (route) => route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: '{"error":"forced fallback by verify-upgrade.mjs"}',
    }));
  }
  const page = await context.newPage();
  const bucket = createBucket('mobile');
  attachCollectors(page, bucket);
  mobile.bucket = bucket;
  const section = '移动端';

  try {
    await page.goto(OPTIONS.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (error) {
    check(`${section}·加载`, '页面可访问', false, { expected: '加载成功', actual: String(error.message || error) });
    await context.close();
    return;
  }
  try {
    await waitForUpgradeReady(page, 60000);
    check(`${section}·加载`, '页面就绪（__fuhua.loaded && __upgrade.ready）', true, { expected: 'true', actual: 'true' });
    mobile.ready = true;
  } catch (error) {
    await handleLoadFailure(page, error, bucket, outDir, section, mobile);
    check(`${section}·加载`, '页面就绪（__fuhua.loaded && __upgrade.ready）', false, {
      expected: 'true', actual: mobile.load ? { loaded: mobile.load.fuhuaLoaded, ready: mobile.load.upgradeReady } : null,
    });
    await context.close();
    return;
  }

  await page.waitForFunction(
    () => document.querySelector('#loading')?.classList.contains('hidden') === true,
    null,
    { timeout: 25000, polling: 120 },
  ).catch(() => {});
  await page.waitForTimeout(1800);

  const mobileState = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: doc.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      clientWidth: doc.clientWidth,
      hasHorizontalOverflow: doc.scrollWidth > window.innerWidth + 1,
      overflowElements: (() => {
        const offenders = [];
        for (const element of document.querySelectorAll('body *')) {
          const rect = element.getBoundingClientRect();
          if (rect.width > 0 && (rect.right > window.innerWidth + 2 || rect.left < -2)) {
            const style = window.getComputedStyle(element);
            if (style.position === 'fixed' || style.position === 'absolute' || style.position === 'relative' || style.position === 'static') {
              offenders.push({
                tag: element.tagName.toLowerCase(),
                id: element.id || null,
                className: typeof element.className === 'string' ? element.className.slice(0, 60) : null,
                left: Math.round(rect.left),
                right: Math.round(rect.right),
              });
              if (offenders.length >= 8) break;
            }
          }
        }
        return offenders;
      })(),
      loadingHidden: document.querySelector('#loading')?.classList.contains('hidden'),
      hasFuhuaCity: Boolean(window.__fuhuaCity),
      cityStats: window.__cityStats || null,
      time: window.__fuhua && window.__fuhua.time,
      fps: window.__fps || null,
      renderInfo: window.__renderInfo || null,
      canvas: (() => {
        const canvas = document.querySelector('#viewport canvas');
        return canvas ? { clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight } : null;
      })(),
    };
  });
  mobile.state = mobileState;

  check(`${section}·布局`, '无横向溢出（scrollWidth ≤ innerWidth+1）',
    mobileState.scrollWidth <= mobileState.innerWidth + 1,
    {
      expected: `≤ ${mobileState.innerWidth + 1}`,
      actual: mobileState.scrollWidth,
      detail: mobileState.hasHorizontalOverflow ? mobileState.overflowElements : null,
    });
  check(`${section}·布局`, 'loading 覆盖层隐藏', mobileState.loadingHidden === true, { expected: true, actual: mobileState.loadingHidden });
  check(`${section}·布局`, '移动端视口内 canvas 正常', Boolean(mobileState.canvas && mobileState.canvas.clientWidth > 300), {
    expected: 'canvas 宽度 > 300', actual: mobileState.canvas,
  });
  // 3D 标签视觉越界（CSS overflow:hidden 裁切，不产生文档横向滚动，但会被切字）
  const labelOverflow = await page.evaluate(() => {
    const offenders = [];
    for (const el of document.querySelectorAll('#city-labels .city-poi, #labels .building-label')) {
      if (el.hidden || !el.offsetParent) continue;
      const text = (el.textContent || '').trim();
      if (!text) continue;
      const rect = el.getBoundingClientRect();
      const leftOver = Math.round(-rect.left);
      const rightOver = Math.round(rect.right - window.innerWidth);
      if (leftOver > 8 || rightOver > 8) offenders.push({ text: text.slice(0, 26), leftOver, rightOver });
    }
    return offenders;
  });
  check(`${section}·布局`, '3D 标签视觉未被视口裁切（±8px）', labelOverflow.length === 0, {
    expected: 0,
    actual: labelOverflow.length,
    detail: labelOverflow.slice(0, 6),
    severity: SEVERITY.WARN,
  });
  info(`${section}·布局`, '移动端视口', mobileState);
  await screenshotsImpl(page, outDir, 'upgrade-mobile.jpg', { quality: 88 });

  addErrorChecks(`${section}·运行时`, bucket, { fallbackForced: OPTIONS.fallback });
  await context.close();
}

/* --------------------------------- 报告输出 ------------------------------- */
function buildReport(startedAt, fatal) {
  const filteredChecks = checks;
  const failures = filteredChecks.filter((item) => !item.pass && item.severity === SEVERITY.FAIL);
  const warnings = filteredChecks.filter((item) => !item.pass && item.severity === SEVERITY.WARN);
  const infos = filteredChecks.filter((item) => item.severity === SEVERITY.INFO);
  const passed = filteredChecks.filter((item) => item.pass && item.severity !== SEVERITY.INFO);
  const report = {
    tool: 'building-atlas/verify-upgrade.mjs',
    generatedAt: nowIso(),
    url: OPTIONS.url,
    mode: desktop.mode || (mobile.state ? 'mobile-only' : 'unknown'),
    options: {
      mobileOnly: OPTIONS.mobileOnly,
      fallback: OPTIONS.fallback,
      noShots: OPTIONS.noShots,
    },
    pass: failures.length === 0 && !fatal,
    fatal: fatal || null,
    durationMs: Date.now() - startedAt,
    summary: {
      checks: filteredChecks.filter((item) => item.severity !== SEVERITY.INFO).length,
      passed: passed.length,
      failed: failures.length,
      warnings: warnings.length,
      infos: infos.length,
    },
    checks: filteredChecks,
    screenshots,
    data: {
      desktopMode: desktop.mode || null,
      staticDeploy: desktop.staticDeploy || null,
      cityStats: (desktop.data && desktop.data.cityStats) || (mobile.state && mobile.state.cityStats) || null,
      cityMeta: (desktop.data && desktop.data.cityMeta) || null,
      dataCounts: (desktop.data && desktop.data.dataCounts) || null,
      roadOrientation: (desktop.data && desktop.data.roadOrientation) || null,
      poiSample: (desktop.data && desktop.data.poiSample) || null,
      minimap: (desktop.data && desktop.data.minimap) || null,
      artifacts: desktop.artifacts ? {
        available: desktop.artifacts.available,
        metaUrl: desktop.artifacts.metaUrl,
        metaError: desktop.artifacts.metaError || null,
        layers: desktop.artifacts.layers,
        glb: desktop.artifacts.glb,
        stats: desktop.artifacts.meta ? desktop.artifacts.meta.stats : null,
        heightModel: desktop.artifacts.meta ? desktop.artifacts.meta.heightModel : null,
      } : null,
    },
    performance: desktop.performance || null,
    runtime: {
      desktop: desktop.bucket ? filterExpectedNoise(desktop.bucket, OPTIONS.fallback) : null,
      mobile: mobile.bucket ? filterExpectedNoise(mobile.bucket, OPTIONS.fallback) : null,
    },
    notes,
  };
  return { report, failures, warnings };
}

function printReport(report, failures, warnings) {
  const line = '─'.repeat(78);
  console.log(`\n${line}`);
  console.log(`富华大厦升级版验收 · ${report.url}`);
  console.log(`模式：${report.mode}   耗时：${(report.durationMs / 1000).toFixed(1)}s   ${report.pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log(line);
  const sections = [];
  for (const item of report.checks) {
    if (!sections.includes(item.section)) sections.push(item.section);
  }
  for (const section of sections) {
    const items = report.checks.filter((item) => item.section === section);
    const visible = items.filter((item) => item.severity !== 'info' || process.env.VERIFY_VERBOSE);
    if (!visible.length) continue;
    console.log(`\n[${section}]`);
    for (const item of visible) {
      let mark = '·';
      if (item.severity === 'fail') mark = item.pass ? '✓' : '✗';
      else if (item.severity === 'warn') mark = item.pass ? '✓' : '⚠';
      else mark = 'ℹ';
      console.log(`  ${mark} ${item.name}`);
      if (!item.pass || process.env.VERIFY_VERBOSE) {
        if (item.expected !== null) console.log(`      期望：${shortValue(item.expected, 300)}`);
        if (item.actual !== null) console.log(`      实际：${shortValue(item.actual, 400)}`);
        if (item.detail) console.log(`      备注：${shortValue(item.detail, 500)}`);
      }
    }
  }
  if (report.screenshots.length) {
    console.log('\n[截图]');
    for (const shot of report.screenshots) console.log(`  🖼 ${shot.path}（${shot.size}）`);
  }
  const perf = report.performance || {};
  const cityStats = report.data.cityStats || {};
  console.log('\n[关键数值]');
  console.log(`  city：buildings=${cityStats.buildings} roads=${cityStats.roads} landuse=${cityStats.landuse} poi=${cityStats.poi} drawCalls=${cityStats.drawCalls} triangles=${cityStats.triangles}${cityStats.fallback ? ' (fallback)' : ''}`);
  console.log(`  render：fps=${perf.fps} calls=${perf.renderInfo ? perf.renderInfo.calls : null} triangles=${perf.renderInfo ? perf.renderInfo.triangles : null}`);
  const data = report.data;
  if (data.roadOrientation) console.log(`  道路朝向：${shortValue(data.roadOrientation, 400)}`);
  if (data.poiSample) console.log(`  POI 抽样：${shortValue(data.poiSample, 500)}`);
  if (data.artifacts && data.artifacts.glb) console.log(`  GLB：${shortValue(data.artifacts.glb, 300)}`);
  console.log('\n[结论]');
  console.log(`  断言 ${report.summary.checks} 项：通过 ${report.summary.passed} / 失败 ${report.summary.failed} / 警告 ${report.summary.warnings}`);
  if (failures.length) {
    console.log('  失败项：');
    for (const failure of failures) console.log(`   ✗ ${failure.section} · ${failure.name}（期望 ${shortValue(failure.expected, 160)} / 实际 ${shortValue(failure.actual, 160)}）`);
  }
  if (warnings.length) {
    console.log('  警告项：');
    for (const warning of warnings) console.log(`   ⚠ ${warning.section} · ${warning.name}（${shortValue(warning.actual, 160)}）`);
  }
  if (report.notes.length) {
    console.log('  备注：');
    for (const item of report.notes) console.log(`   · ${item}`);
  }
  console.log(`${line}\n`);
}

/* ---------------------------------- 入口 ---------------------------------- */
async function main() {
  const startedAt = Date.now();
  fs.mkdirSync(OPTIONS.out, { recursive: true });
  fs.mkdirSync(path.dirname(OPTIONS.json), { recursive: true });

  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({
    headless: !OPTIONS.headed,
    args: ['--use-angle=metal', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });

  let fatal = null;
  try {
    if (OPTIONS.mobileOnly) {
      await runMobile(browser, OPTIONS.out);
    } else {
      await runDesktop(browser, OPTIONS.out);
      await runMobile(browser, OPTIONS.out);
    }
    if (!desktop.ready && !mobile.ready) {
      fatal = '页面未能进入可验收状态（所有视口加载失败）';
    }
  } catch (error) {
    fatal = String(error && error.stack ? error.stack : error);
    console.error('✗ 验收脚本异常：', error);
  } finally {
    await browser.close().catch(() => {});
  }

  const { report, failures, warnings } = buildReport(startedAt, fatal);
  report.fatal = fatal || null;
  fs.writeFileSync(OPTIONS.json, `${JSON.stringify(report, null, 2)}\n`);
  printReport(report, failures, warnings);
  console.log(`报告：${OPTIONS.json}`);
  process.exit(report.pass ? 0 : 1);
}

main().catch((error) => {
  console.error('✗ 未捕获异常：', error);
  process.exit(1);
});
