import { chromium } from 'playwright';
import fs from 'fs';
const src = fs.readFileSync('/Users/one/AI/demo/apps/flood-sim/docs/research/ms2sd1-source.glsl','utf8');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setContent('<canvas id=c width=8 height=8></canvas>');
const run = async (ver) => page.evaluate(({src, ver}) => {
  const gl = document.getElementById('c').getContext(ver === 1 ? 'webgl' : 'webgl2');
  if (!gl) return { err: 'no ctx ' + ver };
  const pre = ver === 1
    ? `precision highp float;\nuniform vec3 iResolution; uniform float iTime; uniform vec4 iMouse;\n`
    : `#version 300 es\nprecision highp float;\nuniform vec3 iResolution; uniform float iTime; uniform vec4 iMouse;\nout vec4 outColor;\n`;
  const epi = ver === 1
    ? `\nvoid main(){ vec4 c; mainImage(c, gl_FragCoord.xy); gl_FragColor = c; }`
    : `\nvoid main(){ vec4 c; mainImage(c, gl_FragCoord.xy); outColor = c; }`;
  const vs = ver === 1 ? `attribute vec2 p; void main(){ gl_Position=vec4(p,0.,1.); }`
                       : `#version 300 es\nin vec2 p; void main(){ gl_Position=vec4(p,0.,1.); }`;
  const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
    return { ok: gl.getShaderParameter(sh, gl.COMPILE_STATUS), log: (gl.getShaderInfoLog(sh)||'').replace(/\0/g,''), sh }; };
  const f = mk(gl.FRAGMENT_SHADER, pre + src + epi);
  const v = mk(gl.VERTEX_SHADER, vs);
  const prog = gl.createProgram(); gl.attachShader(prog, f.sh); gl.attachShader(prog, v.sh);
  gl.linkProgram(prog); gl.useProgram(prog); gl.viewport(0,0,8,8); gl.drawArrays(gl.TRIANGLES,0,3);
  const px = new Uint8Array(4);
  let drawErr = gl.getError(); let pixel = null;
  if (drawErr === gl.NO_ERROR) { gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px); pixel = [...px]; }
  return { fragOk: f.ok, fragLog: f.log, linked: gl.getProgramParameter(prog, gl.LINK_STATUS), drawErr, pixel };
}, { src, ver });
console.log('WEBGL1:', JSON.stringify(await run(1), null, 2));
console.log('WEBGL2:', JSON.stringify(await run(2), null, 2));
await browser.close();
