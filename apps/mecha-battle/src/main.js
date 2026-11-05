import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { FixedStep } from './runtime/fixedStep.js';
import { initDebrisPhysics } from './world/debrisPhysics.js';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { ToonInkShader } from './world/ToonInkShader.js';
import { installStudioReflections } from './world/characterDesign.js';
import { UI } from './ui.js';
import { AudioEngine } from './audio.js';
import { Game } from './game.js';
import { preloadUrbanTrees } from './world/urbanTrees.js';
import { preloadCharacters } from './world/importedCharacters.js';

const boot = {
  el: document.getElementById('boot'),
  progress: document.getElementById('boot-progress'),
  status: document.getElementById('boot-status'),
};

function bootStatus(p, text) {
  if (boot.progress) boot.progress.style.width = `${p * 100}%`;
  if (boot.status) boot.status.textContent = text;
}

async function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function main() {
  const ui = new UI();
  const audio = new AudioEngine();
  bootStatus(0.06, '正在唤醒渲染核心…');
  await nextFrame();

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('stage'),
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
  } catch (err) {
    console.error(err);
    ui.showSystemError('无法初始化 WebGL。请更新浏览器或开启硬件加速后重试。');
    ui.finishBoot();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.info.autoReset = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.4, 650);
  scene.add(camera);
  const reflectionTarget = await installStudioReflections(renderer, scene);

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  composer.setSize(window.innerWidth, window.innerHeight);
  const renderPass = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.18, 0.45, 1.15);
  const outputPass = new OutputPass();
  const smaa = new SMAAPass();
  const contactAO = new GTAOPass(scene,camera,window.innerWidth,window.innerHeight,undefined,
    {radius:2,thickness:1,distanceExponent:1.3,samples:8,screenSpaceRadius:false});
  contactAO.blendIntensity=.65;
  contactAO.enabled=false;
  const renderAO=contactAO.render.bind(contactAO);
  contactAO.render=(...args)=>{
    const hidden=[];
    scene.traverseVisible(object=>{
      if(!object.isMesh)return;
      const materials=Array.isArray(object.material)?object.material:[object.material];
      if(materials.every(material=>material.transparent)){
        hidden.push(object);object.visible=false;
      }
    });
    // The beauty image is already rendered. Transparent exhaust, ground cues
    // and sprites must not become solid blockers in the AO normal/depth pass.
    try{return renderAO(...args);}finally{for(const object of hidden)object.visible=true;}
  };
  const toonInk = new ShaderPass(ToonInkShader);
  toonInk.uniforms.resolution.value = new THREE.Vector2(window.innerWidth, window.innerHeight);
  toonInk.uniforms.inkColor.value = new THREE.Color('#080b13');
  toonInk.uniforms.edgeStrength.value = 0.0;
  toonInk.uniforms.levels.value = 48.0;
  toonInk.uniforms.edgeLow.value = 0.045;
  toonInk.uniforms.edgeHigh.value = 0.18;
  composer.addPass(renderPass);
  composer.addPass(contactAO);
  composer.addPass(bloom);
  composer.addPass(smaa);
  composer.addPass(outputPass);
  toonInk.enabled = false;
  composer.addPass(toonInk);

  bootStatus(0.24, '正在生成新港市街区…');
  await nextFrame();
  let game;
  try {
    bootStatus(0.32, '正在加载机甲与巨兽模型…');
    await Promise.all([preloadCharacters(),preloadUrbanTrees(),initDebrisPhysics()]);
    game = new Game({ scene, camera, renderer, ui, audio });
  } catch (err) {
    console.error('Game init failed', err);
    ui.showSystemError(`场景初始化失败：${err.message || err}`);
    ui.finishBoot();
    return;
  }
  bootStatus(0.7, '正在布置行人、车流与霓虹灯…');
  await new Promise((r) => setTimeout(r, 400));
  bootStatus(0.92, '防御协议就绪。');
  await new Promise((r) => setTimeout(r, 380));
  bootStatus(1, '欢迎来到新港市。');
  ui.finishBoot();
  window.__STEEL_DAWN__ = { game, ui, audio, scene, camera, renderer, bloom, smaa, contactAO, toonInk, reflectionTarget };
  game.update(1 / 60);

  game.effects.physics.buildings = () => game.city?.buildings || [];
  const simulation = new FixedStep();
  window.__STEEL_DAWN__.simulation = simulation;
  document.addEventListener('visibilitychange', () => {
    simulation.reset();
    game.keyboard.reset();
    game.pose.clearEvents();
    if (document.hidden && game.state === 'playing') game.pauseGame();
  });
  const timer = new THREE.Timer();
  timer.connect(document);
  let fpsSamples = [];
  let qualityReduced = false;
  let lastAdapt = 0;
  const applyQuality = settings => {
    const cap={auto:1.75,high:1.75,balanced:1.25,low:1}[settings.quality];
    const ratio=Math.min(window.devicePixelRatio||1,cap);
    renderer.setPixelRatio(ratio);composer.setPixelRatio(ratio);
    composer.setSize(window.innerWidth,window.innerHeight);
    bloom.enabled=settings.quality!=='low';
    smaa.enabled=settings.quality!=='low';
    contactAO.enabled=settings.quality==='high';
    renderer.shadowMap.enabled=settings.quality!=='low';
    const shadowSize=settings.quality==='balanced'?1024:2048;
    const shadow=game.environment.sun.shadow;
    if(shadow.mapSize.x!==shadowSize){shadow.map?.dispose();shadow.map=null;shadow.mapSize.set(shadowSize,shadowSize);}
    renderer.shadowMap.needsUpdate=true;
    qualityReduced=false;fpsSamples.length=0;lastAdapt=game.time;
  };
  game.onSettingsChange=applyQuality;
  applyQuality(game.settings);


  function animate() {
    requestAnimationFrame(animate);
    timer.update();
    const frameDt = timer.getDelta();
    const dt = Math.min(frameDt, 0.05);
    simulation.advance(frameDt, step => game.update(step));
    game.present(dt);
    renderer.info.reset();
    composer.render();

    // 自适应分辨率：持续掉帧时降低像素比，保证体感与战斗帧率
    if (frameDt > 0) fpsSamples.push(frameDt);
    if (fpsSamples.length > 90) fpsSamples.shift();
    if (game.settings.quality === 'auto' && !qualityReduced && fpsSamples.length === 90 && game.time - lastAdapt > 7) {
      const avg = fpsSamples.length / fpsSamples.reduce((a, b) => a + b, 0);
      if (avg < 44) {
        qualityReduced = true;
        lastAdapt = game.time;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
        composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
        bloom.strength = 0.18;
        composer.setSize(window.innerWidth, window.innerHeight);
        console.info('[STEEL DAWN] Adaptive quality: reduced pixel ratio', avg.toFixed(1));
      }
    }
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloom.setSize(w, h);
    toonInk.uniforms.resolution.value.set(w, h);
  }
  window.addEventListener('resize', resize);
  // A resize can occur while the asynchronous boot screen is still running.
  resize();

  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    ui.showSystemError('GPU 上下文丢失。请刷新页面重新进入新港市。');
  });

  timer.reset();
  animate();
}

main().catch((err) => {
  console.error(err);
  const el = document.getElementById('system-error');
  if (el) {
    el.classList.remove('hidden');
    el.textContent = `启动失败：${err.message || err}`;
  }
  const b = document.getElementById('boot');
  if (b) b.classList.add('done');
});
