/// <reference types="vite/client" />

/** Vite 注入的构建期常量类型声明。 */
interface ImportMetaEnvOverride {
  readonly BASE_URL: string;
  readonly MODE: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
}

declare global {
  interface ImportMeta {
    readonly env: ImportMetaEnvOverride;
  }
}

export {};
