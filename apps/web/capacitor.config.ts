import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pks.app',
  appName: '知识',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  // 关键：App 页面 origin 是 https://localhost，而局域网更新源是 http://192.168.x.x，
  // 属于「混合内容（mixed content）」。Android WebView 默认 MIXED_CONTENT_NEVER_ALLOW，
  // 会直接拦断 fetch → 报 "Failed to fetch"。Capacitor 只有在 android.allowMixedContent
  // 为 true 时才调用 setMixedContentMode(ALWAYS_ALLOW)（见 Bridge.initWebView），
  // 该键默认 false，故必须显式打开。
  // 注意：AndroidManifest 的 usesCleartextTraffic="true" 只放行系统网络栈的明文，
  // 并不能打开 WebView 的混合内容开关——二者是两道独立的门。
  android: {
    allowMixedContent: true,
  },
};

export default config;
