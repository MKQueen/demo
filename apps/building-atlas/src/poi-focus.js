/**
 * poi-focus.js —— 街区地标「聚焦标记」
 *
 * 解决「点选地标后镜头飞过去，目标建筑混在一片白模里、被周边楼挡住」的问题：
 *   1) 光环 + 竖直光柱：即使在密集街区也能一眼定位目标；
 *   2) footprintBBox 金色线框 + 半透明体块：直接框出目标建筑的真实体量；
 *   3) 所有标记材质 depthTest=false + 高 renderOrder：被任何建筑遮挡时仍以「X 光透视」方式可见；
 *   4) 高度由向下射线在 OSM 白模上探测（取最高命中面），无需改数据格式。
 *
 * 与 main.js 的边界：只负责 3D 标记，不接管相机；相机由 main.js 的 focusPoi 编排。
 */
import * as THREE from 'three';

const GOLD = 0xf4b35b;
const DIM = 0x9db4c4;
const MARK_RENDER_ORDER = 30;

function markerMaterial(color, opacity, extra = {}) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    ...extra,
  });
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function createPoiFocus({ scene, getCity } = {}) {
  const group = new THREE.Group();
  group.name = 'poi-focus';
  group.visible = false;
  if (scene) scene.add(group);

  /* 光柱 */
  const beamHeight = 320;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 2.6, beamHeight, 12, 1, true),
    markerMaterial(GOLD, 0.22, { blending: THREE.AdditiveBlending }),
  );
  beam.position.y = beamHeight / 2;
  beam.renderOrder = MARK_RENDER_ORDER;
  group.add(beam);

  /* 地面光环（两道） */
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(16, 19.5, 64),
    markerMaterial(GOLD, 0.75),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 1.5;
  ring.renderOrder = MARK_RENDER_ORDER;
  group.add(ring);

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(24, 25.4, 64),
    markerMaterial(GOLD, 0.35),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 1.45;
  halo.renderOrder = MARK_RENDER_ORDER;
  group.add(halo);

  /* 目标建筑体量框（按需创建） */
  const raycaster = new THREE.Raycaster();
  raycaster.far = 1400;
  const down = new THREE.Vector3(0, -1, 0);
  const rayOrigin = new THREE.Vector3();
  let outline = null; // { box, mesh, edges, height }
  let activePoi = null;
  let elapsed = 0;

  function disposeOutline() {
    if (!outline) return;
    group.remove(outline.mesh);
    group.remove(outline.edges);
    outline.mesh.geometry.dispose();
    outline.mesh.material.dispose();
    outline.edges.geometry.dispose();
    outline.edges.material.dispose();
    outline = null;
  }

  function estimateHeight(bbox) {
    const city = getCity ? getCity() : null;
    if (!bbox || !city || !city.group || !city.loaded) return 16;
    const cx = (bbox[0] + bbox[2]) / 2;
    const cz = (bbox[1] + bbox[3]) / 2;
    rayOrigin.set(cx, 600, cz);
    raycaster.set(rayOrigin, down);
    let hits = [];
    try {
      hits = raycaster.intersectObject(city.group, true);
    } catch {
      hits = [];
    }
    for (const hit of hits) {
      if (hit.point && hit.point.y > 1.5) return clamp(hit.point.y, 6, 220);
    }
    return 16;
  }

  function buildOutline(bbox) {
    disposeOutline();
    if (!bbox || bbox.length < 4) return;
    const w = Math.max(4, bbox[2] - bbox[0]);
    const d = Math.max(4, bbox[3] - bbox[1]);
    const h = estimateHeight(bbox);
    const cx = (bbox[0] + bbox[2]) / 2;
    const cz = (bbox[1] + bbox[3]) / 2;
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(
      geo,
      markerMaterial(GOLD, 0.075),
    );
    mesh.position.set(cx, h / 2, cz);
    mesh.renderOrder = MARK_RENDER_ORDER;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false }),
    );
    edges.position.set(cx, h / 2, cz);
    edges.renderOrder = MARK_RENDER_ORDER + 1;
    group.add(mesh);
    group.add(edges);
    outline = { mesh, edges, height: h };
  }

  function focus(poi) {
    if (!poi) return null;
    activePoi = poi;
    const x = Number(poi.x) || 0;
    const z = Number(poi.z) || 0;
    group.position.set(x, 0, z);
    group.visible = true;
    elapsed = 0;
    buildOutline(poi.footprintBBox);
    return { x, z, height: outline ? outline.height : 16 };
  }

  function clear() {
    activePoi = null;
    group.visible = false;
    disposeOutline();
  }

  function update(dt = 0) {
    if (!group.visible) return;
    elapsed += dt;
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 2.6);
    ring.material.opacity = 0.5 + 0.38 * pulse;
    halo.material.opacity = 0.18 + 0.28 * pulse;
    const haloScale = 1 + 0.14 * pulse;
    halo.scale.set(haloScale, haloScale, 1);
    beam.material.opacity = 0.16 + 0.12 * pulse;
    if (outline) outline.edges.material.opacity = 0.72 + 0.26 * pulse;
  }

  function dispose() {
    clear();
    if (scene) scene.remove(group);
    group.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) object.material.dispose();
    });
  }

  return {
    group,
    focus,
    clear,
    update,
    dispose,
    get poi() {
      return activePoi;
    },
    get height() {
      return outline ? outline.height : 0;
    },
  };
}
