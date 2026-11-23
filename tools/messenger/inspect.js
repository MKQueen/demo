import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const BASE='/apps/beijing-courier/public/assets-messenger/';
const renderer = new THREE.WebGLRenderer({antialias:true, alpha:false});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(1);
document.body.appendChild(renderer.domElement);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x88dddd);
const camera = new THREE.PerspectiveCamera(45, innerWidth/innerHeight, 0.01, 10000);
scene.add(new THREE.HemisphereLight(0xffffff, 0x445544, 2.2));
const dir = new THREE.DirectionalLight(0xffffff, 2); dir.position.set(3,5,4); scene.add(dir);

const draco = new DRACOLoader();
draco.setDecoderPath('/apps/beijing-courier/node_modules/three/examples/jsm/libs/draco/gltf/');
draco.setDecoderConfig({type:'wasm'});
const ktx2 = new KTX2Loader().setTranscoderPath('/apps/beijing-courier/node_modules/three/examples/jsm/libs/basis/').detectSupport(renderer);

window.__T = {THREE, renderer, scene, camera, draco, ktx2};
window.__loadDraco = (url) => new Promise((res,rej)=>{
  draco.load(BASE+url, g=>res(g), undefined, e=>rej(e));
});
window.__loadKTX2 = (url) => new Promise((res,rej)=>{
  ktx2.load(BASE+url, t=>res(t), undefined, e=>rej(e));
});
window.__fit = (obj, padding=1.3)=>{
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x,size.y,size.z);
  const fov = camera.fov * Math.PI/180;
  let dist = (maxDim/2) / Math.tan(fov/2) * padding;
  camera.position.copy(center).add(new THREE.Vector3(dist*.6, dist*.55, dist*.7));
  camera.near = maxDim/1000; camera.far = maxDim*100; camera.updateProjectionMatrix();
  camera.lookAt(center);
  return {box:{min:box.min.toArray(),max:box.max.toArray()}, size:size.toArray(), center:center.toArray(), dist};
};
window.__info = (g)=>{
  const attrs={};
  for(const k in g.attributes){const a=g.attributes[k];attrs[k]={itemSize:a.itemSize,count:a.count,type:a.array.constructor.name,min:a.min?Array.from(a.min):null,max:a.max?Array.from(a.max):null};}
  return {attrs, index:g.index?{count:g.index.count,type:g.index.array.constructor.name}:null, userData:g.userData, groups:g.groups, bbox:g.boundingBox};
};
window.__ready = true;
