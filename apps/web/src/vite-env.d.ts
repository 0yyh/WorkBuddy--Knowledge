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
  /** vite define 注入的应用版本号（package.json version），构建期替换为字面量 */
  declare const __PKS_APP_VERSION__: string;
}

export {};
