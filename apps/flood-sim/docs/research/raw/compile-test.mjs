import { chromium } from 'playwright';
import fs from 'fs';
const src = fs.readFileSync('/Users/one/AI/demo/apps/flood-sim/docs/research/ms2sd1-source.glsl','utf8');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setContent('<canvas id=c width=8 height=8></canvas>');
const res = await page.evaluate(({src}) => {
  const gl = document.getElementById('c').getContext('webgl2');
  if (!gl) return { err: 'no webgl2' };
  const vs = `#version 300 es
in vec2 p; void main(){ gl_Position=vec4(p,0.,1.); }`;
  // rebuild a main() that calls mainImage
  const wrap = `#version 300 es
precision highp float;
uniform vec3 iResolution; uniform float iTime; uniform vec4 iMouse;
out vec4 outColor;
` + src + `
void main(){ vec4 c; mainImage(c, gl_FragCoord.xy); outColor = c; }`;
  const mk = (type, s) => { const sh = gl.createShader(type); gl.shaderSource(sh, s); gl.compileShader(sh);
    return { ok: gl.getShaderParameter(sh, gl.COMPILE_STATUS), log: gl.getShaderInfoLog(sh), sh }; };
  const f = mk(gl.FRAGMENT_SHADER, wrap);
  const prog = gl.createProgram(); gl.attachShader(prog, f.sh);
  const v = mk(gl.VERTEX_SHADER, vs); gl.attachShader(prog, v.sh);
  gl.linkProgram(prog);
  const linked = gl.getProgramParameter(prog, gl.LINK_STATUS);
  return { fragOk: f.ok, fragLog: f.log, vertOk: v.ok, vertLog: v.log, linked, linkLog: gl.getProgramInfoLog(prog) };
}, { src });
console.log(JSON.stringify(res, null, 2));
await browser.close();
