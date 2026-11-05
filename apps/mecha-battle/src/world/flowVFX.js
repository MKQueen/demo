import * as THREE from 'three';

// Crossed, transparent flow sheets with advected noise. No opaque flame cones.
// Units: local +Z is the emission direction; length and width are world metres.
const vertexShader=`
  varying vec2 vUv;
  void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
`;
const fragmentShader=`
  varying vec2 vUv;
  uniform float uTime,uPower,uSeed,uMode,uTaper;
  uniform vec3 uColor;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),f.x),f.y);}
  float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+13.7;a*=.5;}return v;}
  void main(){
    float t=vUv.y,x=vUv.x*2.-1.;
    float speed=uMode<.5?3.8:1.8;
    vec2 flow=vec2(x*3.+uSeed,t*9.-uTime*speed*5.);
    float n=fbm(flow),curl=fbm(flow*.58+vec2(2.,-uTime));
    float width=uMode<.5?(.65*pow(1.-t,.65)+.02):(.18+(.75*uTaper)*t);
    float edge=1.-smoothstep(width*.25,width,abs(x+(curl-.5)*.38*t));
    float tip=1.-smoothstep(.65,1.,t);
    float density=smoothstep(.18,.7,n)*edge*tip*smoothstep(0.,.025,t);
    float spine=pow(max(0.,1.-abs(x)/max(.02,width*.42)),3.)*(1.-t);
    float diamonds=uMode<.5?pow(.5+.5*cos(t*48.-uTime*5.),8.)*.28:0.;
    float fire=step(.5,uMode);
    spine*=mix(1.,.03,fire);
    float heat=mix(clamp(spine+diamonds,0.,1.),smoothstep(.42,.88,n)*.65,fire);
    vec3 hot=mix(uColor,mix(vec3(1.,.95,.8),vec3(1.,.7,.16),fire),heat);
    float alpha=clamp((density*mix(.75,.7,fire)+spine*.4)*uPower,0.,.8);
    if(alpha<.015)discard;
    gl_FragColor=vec4(hot*(1.2+spine*1.8),alpha);
    #include <colorspace_fragment>
  }
`;
export function createFlow({color='#59cfff',mode=0,sheets=3}={}) {
  const group=new THREE.Group();group.name=mode===1?'turbulent-kaiju-breath':'turbulent-exhaust';
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,0,0,1,0,0,-1,0,1,1,0,1],3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1],2));
  geometry.setIndex([0,1,2,2,1,3]);geometry.computeBoundingSphere();
  for(let i=0;i<sheets;i++) {
    const material=new THREE.ShaderMaterial({vertexShader,fragmentShader,
      uniforms:{uTime:{value:0},uPower:{value:1},uSeed:{value:i*7.43},uMode:{value:mode},uTaper:{value:1},uColor:{value:new THREE.Color(color)}},
      transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:mode===1?THREE.NormalBlending:THREE.AdditiveBlending,toneMapped:false});
    const mesh=new THREE.Mesh(geometry,material);mesh.rotation.z=i*Math.PI/sheets;
    mesh.frustumCulled=false;group.add(mesh);
  }
  return group;
}
export function setFlow(flow,time,power,width,length) {
  flow.scale.set(width,width,length);
  for(const sheet of flow.children){sheet.material.uniforms.uTime.value=time;sheet.material.uniforms.uPower.value=power;}
}
