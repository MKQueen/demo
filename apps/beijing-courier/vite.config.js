import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5190 },
  build: { target:'es2020', chunkSizeWarningLimit:1000 },
  plugins:[{
    name:'offline-shell',
    closeBundle() {
      const root=path.resolve('dist');
      const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
      const assets=walk(root).filter(f=>!f.endsWith('sw.js')).map(f=>'./'+path.relative(root,f).split(path.sep).join('/'));
      const sw=fs.readFileSync(path.resolve('public/sw.js'),'utf8').replace('__PRECACHE__',JSON.stringify(['./',...assets]));
      fs.writeFileSync(path.join(root,'sw.js'),sw);
    }
  }]
});
