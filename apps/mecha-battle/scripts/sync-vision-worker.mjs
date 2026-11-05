import { copyFile } from 'node:fs/promises';
// Classic workers need the package's IIFE build; Vite's module wrapper cannot use importScripts.
await copyFile(new URL('../node_modules/@mediapipe/tasks-vision/vision_bundle.js', import.meta.url),
  new URL('../public/mediapipe/vision_bundle.js', import.meta.url));
