/**
 * WaterRenderer.js
 * ---------------------------------------------------------------------------
 * 「潮线 TIDELINE · 3D 动态水淹模拟」水面渲染器。
 *
 * 主方案：Cesium.PostProcessStage 屏幕空间水面
 *   - 每像素从 depthTexture 重建场景世界坐标（ENU 局部米），
 *   - 与「海拔 = waterLevel 的球面（带曲率修正）」做解析求交，
 *   - tWater < tScene 的像素判定为水面，再用 Seascape (ShaderToy Ms2SD1)
 *     移植的波浪/反射/折射/焦散/泡沫着色。
 *   - 非水面像素只做「深度重建 + 求交」就立即返回，不进入噪声计算。
 *
 * 兼容方案：Cesium.Material + 水面 Rectangle（Entity），见 waterMaterial.js。
 *   没有场景深度，无法做折射/焦散/岸边泡沫，作为降级/对照演示。
 *
 * 对外接口（与 docs/INTERFACES.md §5 一致）：
 *   constructor(viewer, { store, centerLon, centerLat, sceneRadius })
 *   setWaterLevel(meters) / setQuality(level) / setWaveOptions(opts)
 *   setEnabled(bool) / update(timeSeconds) / setMaterialMode(mode) / destroy()
 *
 * 依赖：CesiumJS 1.147（ES module），从 'cesium' 解析。
 * 许可：水面算法来自 Seascape / TDM（CC BY-NC-SA 3.0），焦散来自
 *       Dave Hoskins（CC BY-NC-SA 3.0），详见 waterPostProcess.glsl.js 文件头。
 * ---------------------------------------------------------------------------
 */

import * as Cesium from 'cesium';
import { createWaterFragmentShader, WATER_QUALITY } from './waterPostProcess.glsl.js';
import { createWaterMaterial } from './waterMaterial.js';

const DEFAULT_CENTER_LON = 120.05;
const DEFAULT_CENTER_LAT = 26.98;
const DEFAULT_SCENE_RADIUS = 9000;
const EARTH_RADIUS = 6371000;

// 复用对象，避免每帧 GC
const scratchCam = new Cesium.Cartesian3();
const scratchDelta = new Cesium.Cartesian3();
const scratchCol = new Cesium.Cartesian3();

function enuDot(vec, basis, result) {
  return Cesium.Cartesian3.fromElements(
    Cesium.Cartesian3.dot(vec, basis.east),
    Cesium.Cartesian3.dot(vec, basis.north),
    Cesium.Cartesian3.dot(vec, basis.up),
    result,
  );
}

/**
 * 把 UI 的 0..1 波浪强度映射到 Seascape 的 SEA_* 参数。
 * 波场单位 = u_waveUnit 米（默认 10m/单位），所以 SEA_HEIGHT 0.03~0.13
 * 对应实际浪高 0.3~1.3 米。
 */
function mapWaveParams({ intensity = 0.65, speed = 0.8, caustics = 0.8 }) {
  const i = Cesium.Math.clamp(intensity, 0, 1);
  const s = Cesium.Math.clamp(speed, 0, 2);
  return {
    waveHeight: 0.040 + 0.115 * i, // SEA_HEIGHT（波场单位）
    waveSpeed: 0.30 + 0.85 * s, // SEA_SPEED
    seaFreq: 0.52 - 0.16 * i, // SEA_FREQ：浪越大，波长越长
    choppy: 3.2 + 1.6 * i, // SEA_CHOPPY：尖峰程度
    caustics: Cesium.Math.clamp(caustics, 0, 1),
  };
}

export class WaterRenderer {
  /**
   * @param {Cesium.Viewer} viewer
   * @param {object} [options]
   * @param {object} [options.store] 共享 Vue store（可选，存在时自动同步 UI 参数）
   * @param {number} [options.centerLon]
   * @param {number} [options.centerLat]
   * @param {number} [options.sceneRadius] 场景半径（米），Material 兼容模式的水面矩形范围
   */
  constructor(viewer, options = {}) {
    if (!viewer || !viewer.scene) {
      throw new Error('[WaterRenderer] 需要有效的 Cesium.Viewer 实例');
    }
    this._viewer = viewer;
    this._scene = viewer.scene;
    this._store = options.store ?? null;
    this._centerLon = options.centerLon ?? DEFAULT_CENTER_LON;
    this._centerLat = options.centerLat ?? DEFAULT_CENTER_LAT;
    this._sceneRadius = options.sceneRadius ?? DEFAULT_SCENE_RADIUS;

    // ⚠️ 关键：Cesium 默认 `globe.depthTestAgainstTerrain = false`，这时它会在
    // globe pass 之后清空深度缓冲（Scene#updateEnvironment 的 clearGlobeDepth），
    // PostProcessStage 拿到的 depthTexture 里就只剩「非地形」物件的深度。
    // 水面必须与地形/海床做深度比较，否则整屏都会被判定成水面。
    // 打开后地形深度会保留（3D Tiles / 实体也会正确地与地形做深度测试）。
    if (options.useTerrainDepth !== false && this._scene.globe) {
      this._scene.globe.depthTestAgainstTerrain = true;
    }

    this._destroyed = false;
    this._enabled = true;
    this._quality = 'high';
    this._materialMode = 'postprocess';
    this._time = 0;

    this._waterLevel = 2.5;
    this._waveOptions = { intensity: 0.65, speed: 0.8, caustics: 0.8 };
    this._wave = mapWaveParams(this._waveOptions);

    // ---- ENU 局部坐标系（原点 = 场景中心的地表点）----
    this._centerECEF = Cesium.Cartesian3.fromDegrees(this._centerLon, this._centerLat);
    const enuFrame = Cesium.Transforms.eastNorthUpToFixedFrame(this._centerECEF);
    this._basis = {
      east: new Cesium.Cartesian3(enuFrame[0], enuFrame[1], enuFrame[2]),
      north: new Cesium.Cartesian3(enuFrame[4], enuFrame[5], enuFrame[6]),
      up: new Cesium.Cartesian3(enuFrame[8], enuFrame[9], enuFrame[10]),
    };

    // ---- uniforms（水位/波浪只改这里的值，不重建 shader）----
    // 注意：Cesium.PostProcessStage 在创建时会把 uniforms 的**值**拷到内部
    // _actualUniforms，之后直接改这个普通对象是无效的（不会上传到 GPU）。
    // 正确做法是改 stage.uniforms（一个带 getter/setter 的代理对象）。
    // 所以这里保留 _baseUniforms 作为规范数据源，this._uniforms 指向当前
    // stage 的代理；重建 stage 时用 _baseUniforms 重新包装。
    this._baseUniforms = {
      // 每帧更新
      u_camENU: new Cesium.Cartesian3(),
      u_eyeToENU0: new Cesium.Cartesian3(),
      u_eyeToENU1: new Cesium.Cartesian3(),
      u_eyeToENU2: new Cesium.Cartesian3(),
      u_tanHalfFov: new Cesium.Cartesian2(1, 1),
      u_pixelFootprint: 0.001,
      u_time: 0,
      u_texel: new Cesium.Cartesian2(1 / 1600, 1 / 1000),
      // 场景常量
      u_eastWC: this._basis.east.clone(),
      u_northWC: this._basis.north.clone(),
      u_upWC: this._basis.up.clone(),
      u_earthRadius: EARTH_RADIUS,
      // 水体 / 波浪
      u_waterLevel: this._waterLevel,
      u_waveHeight: this._wave.waveHeight,
      u_waveSpeed: this._wave.waveSpeed,
      u_seaFreq: this._wave.seaFreq,
      u_choppy: this._wave.choppy,
      u_waveUnit: 10.0,
      u_ssr: 1.0,
      u_caustics: this._wave.caustics,
      u_foam: 1.0,
      u_refraction: 0.65,
      u_absorb: new Cesium.Cartesian3(0.18, 0.055, 0.034), // 1/米：红光最先被吸收
      u_shallowColor: new Cesium.Cartesian3(0.050, 0.235, 0.290),
      u_deepColor: new Cesium.Cartesian3(0.028, 0.105, 0.175),
      u_scatterColor: new Cesium.Cartesian3(0.075, 0.25, 0.30),
      u_foamColor: new Cesium.Cartesian3(0.96, 0.98, 0.98),
      u_sunColor: new Cesium.Cartesian3(1.0, 0.78, 0.50),
      u_debug: 0,
      u_normalScale: 1.0,
      u_specScale: 1.0,
      u_motion: 0.0,
    };

    // 在 stage 创建前先指向规范对象（此时直接改也生效，因为还没被拷贝）
    this._uniforms = this._baseUniforms;

    this._stage = null;
    this._stageSeq = 0;
    // 相机运动检测（用于缩放/飞行时抑制反射/波光闪烁，见 u_motion）
    this._lastCamPosWC = new Cesium.Cartesian3();
    this._lastCamDirWC = new Cesium.Cartesian3();
    this._lastUpdateTime = -1;
    this._motion = 0;
    this._material = null;
    this._waterPrimitive = null;
    this._waterAppearance = null;

    this._createStage();
    this._applyWaveUniforms();
  }

  // =========================================================================
  // 内部：PostProcessStage 生命周期
  // =========================================================================

  /**
   * 每帧从当前 stage 取一次 uniforms 代理对象。
   * Cesium.PostProcessStage 在第一次渲染时把 options.uniforms 包一层 getter/setter
   * （并把值复制到内部 _actualUniforms）；只有通过这层代理写值才会真正上传 GPU。
   */
  _refreshUniforms() {
    if (this._stage) {
      this._uniforms = this._stage.uniforms;
    } else {
      this._uniforms = this._baseUniforms;
    }
  }

  _createStage() {
    const q = WATER_QUALITY[this._quality] ?? WATER_QUALITY.high;
    const fragmentShader = createWaterFragmentShader(this._quality);

    this._stageSeq += 1;
    this._stage = new Cesium.PostProcessStage({
      name: `flood-water-${this._quality}-${this._stageSeq}`,
      fragmentShader,
      uniforms: this._baseUniforms,
      textureScale: q.textureScale,
      sampleMode: Cesium.PostProcessStageSampleMode.LINEAR,
    });
    this._stage.enabled = this._enabled && this._materialMode === 'postprocess';
    this._scene.postProcessStages.add(this._stage);
    this._refreshUniforms();
    // 注意：Cesium 的代理对象是在 stage 第一次 update（渲染）时才建立的，
    // 所以这里不能缓存 stage.uniforms；每帧用 _refreshUniforms() 重新取。
  }

  _destroyStage() {
    if (!this._stage) return;
    const stage = this._stage;
    this._stage = null;
    this._refreshUniforms();   // 退回到 _baseUniforms，避免继续写已销毁 stage 的代理
    try {
      // ⚠️ Cesium 1.147 的 PostProcessStageCollection.remove() 内部会调用
      // stage.destroy()；这里**不能**再手动 destroy 一次，否则会抛
      // DeveloperError: This object was destroyed, i.e., destroy() was called.
      this._scene.postProcessStages.remove(stage);
    } catch (e) {
      // stage 可能已经被外部移除/销毁，忽略即可
    }
  }

  _applyWaveUniforms() {
    const u = this._uniforms;
    u.u_waveHeight = this._wave.waveHeight;
    u.u_waveSpeed = this._wave.waveSpeed;
    u.u_seaFreq = this._wave.seaFreq;
    u.u_choppy = this._wave.choppy;
    u.u_caustics = this._wave.caustics;
    if (this._material) {
      const mu = this._material.uniforms;
      mu.u_waveHeight = this._wave.waveHeight;
      mu.u_waveSpeed = this._wave.waveSpeed;
      mu.u_seaFreq = this._wave.seaFreq;
      mu.u_choppy = this._wave.choppy;
      mu.u_caustics = this._wave.caustics;
    }
  }

  // =========================================================================
  // 内部：Material 兼容方案
  // =========================================================================

  _createMaterialFallback() {
    if (this._waterPrimitive) return;
    const r = this._sceneRadius;
    const latDelta = r / 111320;
    const cosLat = Math.cos(Cesium.Math.toRadians(this._centerLat));
    const lonDelta = r / (111320 * cosLat);
    const west = this._centerLon - lonDelta;
    const east = this._centerLon + lonDelta;
    const south = this._centerLat - latDelta;
    const north = this._centerLat + latDelta;

    this._material = createWaterMaterial({
      stScale: new Cesium.Cartesian2((2 * lonDelta * 111320 * cosLat) / 10, (2 * latDelta * 111320) / 10),
    });
    const material = this._material;
    material.uniforms.u_time = this._time;
    material.uniforms.u_waterLevel = this._waterLevel;
    material.uniforms.u_foam = this._uniforms?.u_foam ?? 0.85;
    material.uniforms.u_sunColor = this._uniforms?.u_sunColor ?? material.uniforms.u_sunColor;
    material.uniforms.u_eastWC = this._basis.east;
    material.uniforms.u_northWC = this._basis.north;
    material.uniforms.u_upWC = this._basis.up;

    // Cesium 的 Entity.rectangle.material 只接受 MaterialProperty（Color/Image），
    // 不能直接塞自定义 fabric Material；这里用 Primitive + MaterialAppearance，
    // 这也是 Cesium 里使用自定义 Material 的标准做法。
    const rectangle = Cesium.Rectangle.fromDegrees(west, south, east, north);
    const geometry = new Cesium.RectangleGeometry({
      rectangle,
      height: 0,
      vertexFormat: Cesium.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
    });
    this._waterAppearance = new Cesium.MaterialAppearance({
      material,
      translucent: true,
      faceForward: true,
      closed: false,
    });
    this._waterPrimitive = this._scene.primitives.add(
      new Cesium.Primitive({
        geometryInstances: new Cesium.GeometryInstance({ geometry }),
        appearance: this._waterAppearance,
        asynchronous: false,
        allowPicking: false,
        modelMatrix: this._waterModelMatrix(),
        show: this._enabled,
      }),
    );
  }

  /** 兼容模式的水面高度：整块矩形沿「场景中心 up」平移（球面曲率近似） */
  _waterModelMatrix() {
    const offset = Cesium.Cartesian3.multiplyByScalar(
      this._basis.up,
      this._waterLevel,
      new Cesium.Cartesian3(),
    );
    return Cesium.Matrix4.fromTranslation(offset);
  }

  _destroyMaterialFallback() {
    if (this._waterPrimitive) {
      this._scene.primitives.remove(this._waterPrimitive);
      this._waterPrimitive = null;
    }
    this._waterAppearance = null;
    if (this._material) {
      this._material.destroy();
      this._material = null;
    }
  }

  // =========================================================================
  // 内部：每帧相机 uniform
  // =========================================================================

  _updateCameraUniforms() {
    const camera = this._scene.camera;
    const u = this._uniforms;
    const basis = this._basis;

    // 相机 ENU 位置
    Cesium.Cartesian3.subtract(camera.positionWC, this._centerECEF, scratchDelta);
    const camENU = enuDot(scratchDelta, basis, u.u_camENU);
    u.u_camENU = camENU;
    // 相机在水面以下时 shader 会直接返回；这里不做额外处理

    // eye 空间三轴在世界（ENU）中的方向：inverseViewMatrix 的第 0/1/2 列
    const iv = camera.inverseViewMatrix;
    Cesium.Cartesian3.fromElements(iv[0], iv[1], iv[2], scratchCol);
    u.u_eyeToENU0 = enuDot(scratchCol, basis, u.u_eyeToENU0);
    Cesium.Cartesian3.fromElements(iv[4], iv[5], iv[6], scratchCol);
    u.u_eyeToENU1 = enuDot(scratchCol, basis, u.u_eyeToENU1);
    Cesium.Cartesian3.fromElements(iv[8], iv[9], iv[10], scratchCol);
    u.u_eyeToENU2 = enuDot(scratchCol, basis, u.u_eyeToENU2);

    // 投影矩阵 → tan(fov/2)。列主序：m[0]=P00, m[5]=P11
    const proj = camera.frustum.projectionMatrix;
    const tanX = Math.abs(proj[0]) > 1e-8 ? 1 / proj[0] : 1;
    const tanY = Math.abs(proj[5]) > 1e-8 ? 1 / proj[5] : 1;
    u.u_tanHalfFov.x = Math.abs(tanX);
    u.u_tanHalfFov.y = Math.abs(tanY);

    // ---- 相机运动量 → u_motion（0..1）：快速缩放/飞行时抑制 SSR 与锐利波光，
    //      静止时立刻恢复满画质。这是纯 uniform 更新，不重建任何资源。----
    this._updateMotionUniform();

    const scale = (WATER_QUALITY[this._quality] ?? WATER_QUALITY.high).textureScale;
    const w = Math.max(1, this._scene.drawingBufferWidth);
    const h = Math.max(1, this._scene.drawingBufferHeight);
    u.u_texel.x = 1 / (w * scale);
    u.u_texel.y = 1 / (h * scale);
    u.u_pixelFootprint = (2 * Math.abs(tanY)) / (h * scale);
    u.u_time = this._time;

    // SSR 只在画质宏允许时开启
    const q = WATER_QUALITY[this._quality] ?? WATER_QUALITY.high;
    u.u_ssr = q.ssr;

    if (this._material) {
      this._material.uniforms.u_time = this._time;
    }
  }

  /**
   * 每帧估算相机运动强度（位置速度 + 角速度），平滑成 0..1 的 u_motion。
   * attack 快（跟手）、release 慢（避免停下来的瞬间突然全画质闪一下）。
   */
  _updateMotionUniform() {
    const camera = this._scene.camera;
    const u = this._uniforms;
    const now = this._time;

    if (this._lastUpdateTime >= 0) {
      const dt = now - this._lastUpdateTime;
      if (dt > 0 && dt < 0.4) {
        const moveDist = Cesium.Cartesian3.distance(camera.positionWC, this._lastCamPosWC);
        const cosAng = Cesium.Math.clamp(
          Cesium.Cartesian3.dot(camera.directionWC, this._lastCamDirWC),
          -1,
          1,
        );
        const ang = Math.acos(cosAng);
        const speed = moveDist / dt;                 // m/s
        const angSpeed = ang / dt;                   // rad/s
        const raw = Cesium.Math.clamp(speed / 220 + angSpeed / 1.1, 0, 1);
        const k = raw > this._motion ? Math.min(1, dt * 18) : Math.min(1, dt * 3.5);
        this._motion += (raw - this._motion) * k;
      } else {
        // 长时间无更新（切后台/暂停）：直接归零，不要残留运动状态
        this._motion = 0;
      }
    }
    if (this._motion < 1e-4) this._motion = 0;

    Cesium.Cartesian3.clone(camera.positionWC, this._lastCamPosWC);
    Cesium.Cartesian3.clone(camera.directionWC, this._lastCamDirWC);
    this._lastUpdateTime = now;
    u.u_motion = this._motion;
  }

  // =========================================================================
  // 内部：与 store 同步（存在 store 时，UI 改参数无需 Lead 额外接线）
  // =========================================================================

  _syncFromStore() {
    const s = this._store;
    if (!s) return;

    if (typeof s.waterLevel === 'number' && s.waterLevel !== this._waterLevel) {
      this.setWaterLevel(s.waterLevel);
    }

    const wi = s.waveIntensity;
    const ws = s.waveSpeed;
    const ca = s.caustics;
    if (
      typeof wi === 'number' &&
      (wi !== this._waveOptions.intensity ||
        ws !== this._waveOptions.speed ||
        ca !== this._waveOptions.caustics)
    ) {
      this.setWaveOptions({ intensity: wi, speed: ws, caustics: ca });
    }

    if (s.quality && s.quality !== this._quality) {
      this.setQuality(s.quality);
    }

    if (typeof s.waterEnabled === 'boolean' && s.waterEnabled !== this._enabled) {
      this.setEnabled(s.waterEnabled);
    }
  }

  // =========================================================================
  // 对外 API
  // =========================================================================

  /** 更新水位（米，海拔）。只写 uniform，必须保持廉价。 */
  setWaterLevel(meters) {
    if (!Number.isFinite(meters)) return;
    this._refreshUniforms();
    this._waterLevel = meters;
    this._uniforms.u_waterLevel = meters;
    if (this._waterPrimitive) {
      this._waterPrimitive.modelMatrix = this._waterModelMatrix();
    }
    if (this._material) {
      this._material.uniforms.u_waterLevel = meters;
    }
  }

  /** 设置画质档位：textureScale 只读，所以换档会重建 stage。 */
  setQuality(quality) {
    const next = WATER_QUALITY[quality] ? quality : 'high';
    // 幂等：同档位且 stage 健在时直接返回（floodApp 的 watch + 每帧
    // _syncFromStore 可能重复调用，避免反复重建 stage）
    if (next === this._quality && this._stage) return;
    this._refreshUniforms();
    this._quality = next;
    if (this._materialMode === 'postprocess') {
      this._destroyStage();
      if (!this._destroyed) {
        this._createStage();
        this._applyWaveUniforms();
        this._stage.enabled = this._enabled;
      }
    } else {
      // material 模式没有 textureScale 概念，但仍记录档位
      this._destroyStage();
      this._applyWaveUniforms();
    }
  }

  /** 波浪/焦散参数：{ intensity: 0..1, speed: 0..2, caustics: 0..1 } */
  setWaveOptions(options = {}) {
    this._refreshUniforms();
    this._waveOptions = {
      intensity: options.intensity ?? this._waveOptions.intensity,
      speed: options.speed ?? this._waveOptions.speed,
      caustics: options.caustics ?? this._waveOptions.caustics,
    };
    this._wave = mapWaveParams(this._waveOptions);
    this._applyWaveUniforms();
    if (this._stage) {
      // 每帧 uniform 已包含 u_time 等，这里无需重建
    }
  }

  /** 开关水面。 */
  setEnabled(enabled) {
    this._refreshUniforms();
    this._enabled = !!enabled;
    if (this._stage) {
      this._stage.enabled = this._enabled && this._materialMode === 'postprocess';
    }
    if (this._waterPrimitive) {
      this._waterPrimitive.show = this._enabled && this._materialMode === 'material';
    }
  }

  /** 每帧调用。timeSeconds 建议传 Cesium.JulianDate 换算后的秒数。 */
  update(timeSeconds) {
    if (this._destroyed) return;
    this._refreshUniforms();
    if (Number.isFinite(timeSeconds)) this._time = timeSeconds;
    this._syncFromStore();
    if (!this._enabled) return;
    this._updateCameraUniforms();
  }

  /** 切换主方案（PostProcessStage）与兼容方案（Material 水面矩形）。 */
  setMaterialMode(mode) {
    const next = mode === 'material' ? 'material' : 'postprocess';
    if (next === this._materialMode) return;
    this._materialMode = next;
    if (next === 'material') {
      if (this._stage) this._stage.enabled = false;
      this._createMaterialFallback();
      if (this._waterPrimitive) this._waterPrimitive.show = this._enabled;
    } else {
      this._destroyMaterialFallback();
      if (!this._stage) this._createStage();
      if (this._stage) this._stage.enabled = this._enabled;
    }
  }

  /** 当前水位（米） */
  getWaterLevel() {
    return this._waterLevel;
  }

  /** 当前画质 */
  getQuality() {
    return this._quality;
  }

  /** 当前 pattern 下正在使用的 stage（调试用） */
  getStage() {
    return this._stage;
  }

  /** 调试：设置 shader 调试可视化模式（0 = 最终画面） */
  setDebugMode(mode) {
    this._refreshUniforms();
    this._uniforms.u_debug = Number(mode) || 0;
  }

  /** 释放所有 GPU / 场景资源。 */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._destroyMaterialFallback();
    this._destroyStage();
    this._store = null;
    this._uniforms = null;
    this._material = null;
  }

  get isDestroyed() {
    return this._destroyed;
  }
}

export default WaterRenderer;
