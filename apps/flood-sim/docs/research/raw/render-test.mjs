import { chromium } from 'playwright';
import fs from 'fs';
const src = fs.readFileSync('/Users/one/AI/demo/apps/flood-sim/docs/research/ms2sd1-source.glsl','utf8');
const browser = await chromium.launch({ headless: true });
const W=640,H=360;
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<canvas id=c width=${W} height=${H}></canvas><style>body{margin:0}</style>`);
const out = await page.evaluate(({src, W, H}) => {
  const gl = document.getElementById('c').getContext('webgl', { preserveDrawingBuffer: true });
  if (!gl) return { err: 'no webgl' };
  const pre = `precision highp float;\nuniform vec3 iResolution; uniform float iTime; uniform vec4 iMouse;\n`;
  const epi = `\nvoid main(){ vec4 c; mainImage(c, gl_FragCoord.xy); gl_FragColor = c; }`;
  const vs = `attribute vec2 p; void main(){ gl_Position=vec4(p,0.,1.); }`;
  const mk=(t,s)=>{const sh=gl.createShader(t);gl.shaderSource(sh,s);gl.compileShader(sh);
    return {ok:gl.getShaderParameter(sh,gl.COMPILE_STATUS),log:gl.getShaderInfoLog(sh),sh};};
  const f=mk(gl.FRAGMENT_SHADER,pre+src+epi), v=mk(gl.VERTEX_SHADER,vs);
  const prog=gl.createProgram();gl.attachShader(prog,f.sh);gl.attachShader(prog,v.sh);gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog,gl.LINK_STATUS)) return {err:'link', log:gl.getProgramInfoLog(prog)};
  gl.useProgram(prog);
  const buf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1, 3,-1, -1,3]),gl.STATIC_DRAW);
  const loc=gl.getAttribLocation(prog,'p'); gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  gl.uniform3f(gl.getUniformLocation(prog,'iResolution'), W, H, 1);
  gl.uniform1f(gl.getUniformLocation(prog,'iTime'), 12.0);
  gl.uniform4f(gl.getUniformLocation(prog,'iMouse'), 0,0,0,0);
  gl.viewport(0,0,W,H); gl.drawArrays(gl.TRIANGLES,0,3);
  const px=new Uint8Array(W*H*4); gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,px);
  // stats
  let sum=0, max=0, nonBlack=0;
  for(let i=0;i<px.length;i+=4){const l=(px[i]+px[i+1]+px[i+2])/3; sum+=l; if(l>max)max=l; if(l>8)nonBlack++;}
  return { err: gl.getError(), mean: sum/(W*H), max, nonBlackPct: 100*nonBlack/(W*H),
           url: document.getElementById('c').toDataURL('image/png') };
}, { src, W, H });
if (out.url) { fs.writeFileSync('raw/ms2sd1-render.png', Buffer.from(out.url.split(',')[1], 'base64')); delete out.url; }
console.log(JSON.stringify(out, null, 2));
await browser.close();
