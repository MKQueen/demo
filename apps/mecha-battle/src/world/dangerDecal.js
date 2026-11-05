import * as THREE from 'three';

// A single ground decal per zone: thin boundaries, directional chevrons and a
// closing countdown. Opacity is deliberately low enough to read street detail.
export function createDangerDecal(type, opts) {
  const group = new THREE.Group();
  const line = type === 'line';
  const radius = opts.radius || 1;
  const width = line ? opts.width : radius * 2;
  const length = line ? opts.length : radius * 2;
  const mat = new THREE.ShaderMaterial({
    uniforms: { progress: { value: 0 }, color: { value: new THREE.Color(opts.color || '#ed582f') },
      shape: { value: line ? 1 : type === 'cone' ? 2 : 0 }, spread: { value: opts.spread || 1 },
      extent: { value: new THREE.Vector2(width, length) } },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `
      varying vec2 vUv;uniform float progress,shape,spread;uniform vec2 extent;uniform vec3 color;
      void main(){
        vec2 p=(vUv-.5)*2.; float boundary,inside;
        if(shape>.5&&shape<1.5){
          boundary=min((1.-abs(p.x))*extent.x*.5,(1.-abs(p.y))*extent.y*.5);
          inside=step(0.,boundary);
        }else{
          float r=length(p);boundary=(1.-r)*extent.x*.5;inside=step(r,1.);
          if(shape>1.5){float angle=abs(atan(p.x,-p.y));inside*=1.-step(spread,angle);
            boundary=min(boundary,(spread-angle)*max(r,.1)*extent.x*.5);}
        }
        float rim=(1.-smoothstep(.12,.4,boundary))*inside;
        float hatch=step(.84,fract((vUv.x*extent.x+vUv.y*extent.y)*.16));
        float front=shape>.5&&shape<1.5?1.-vUv.y:length(p);
        float sweep=(1.-smoothstep(.01,.04,abs(front-progress)))*inside;
        float alpha=(.045+hatch*.075+rim*.48+sweep*.22)*inside;
        if(alpha<.01)discard;
        gl_FragColor=vec4(color,alpha);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, toneMapped: false,
  });
  const centers = type === 'multi' ? opts.centers : [opts.center];
  for (const center of centers) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(center.x, .13, center.z);
    if (line) mesh.position.z += length / 2;
    group.add(mesh);
  }
  // Keep origin at the attacker's feet so heading changes rotate the full lane.
  if (type !== 'multi') {
    group.position.set(opts.center.x, 0, opts.center.z);
    for (const child of group.children) {child.position.x-=opts.center.x;child.position.z-=opts.center.z;}
    group.rotation.y = opts.angle || 0;
  }
  return { group, mat, type, ...opts };
}
