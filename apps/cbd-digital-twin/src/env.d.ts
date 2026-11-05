/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}

interface ImportMetaEnv {
  readonly VITE_CESIUM_ION_TOKEN?: string;
  readonly VITE_TDT_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  CESIUM_BASE_URL?: string;
}
