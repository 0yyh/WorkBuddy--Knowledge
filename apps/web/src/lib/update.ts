/**
 * 轻量 OTA（自更新）：
 *  - 从公开 manifest 拉取 { latestVersion, apkUrl, sha256?, notes? }
 *  - 版本号大于当前版本 → 返回新版本信息；否则返回 null。
 *  - 安装降级：不引入 file-opener 等运行时依赖。当前实现为「提示 + 复制 APK 链接」，
 *    用户自行粘贴到浏览器下载后由系统安装器安装。
 *
 * TODO(OTA): 当具备公开静态托管后，把 UPDATE_MANIFEST_URL 换成真实地址。
 * 未来若接入 Capacitor FileOpener，可在 checkForUpdate 命中后直接下载并唤起系统安装器。
 */
export interface UpdateManifest {
  latestVersion: string;
  apkUrl: string;
  sha256?: string;
  notes?: string;
}

/** TODO(OTA): 占位更新清单地址 —— 上线前替换为真实公开 URL */
export const UPDATE_MANIFEST_URL = 'https://your-host.example.com/pks/updates/manifest.json';

/**
 * 当前是否已配置真实更新清单地址。
 *  - false（默认）：自更新未配置——设置页的「检查更新」按钮直接禁用 + 一行说明，避免
 *    用户点击后看到"占位 URL"的失败 toast。
 *  - 替换为真实 URL 后，把这里改为 true（或者在 CI 里由注入脚本替换）。
 */
export const UPDATE_MANIFEST_CONFIGURED = false;

/** 语义化版本号比较：a>b → 1；a<b → -1；相等 → 0。非法段按 0 处理 */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('.').map((s) => Number.parseInt(s, 10) || 0);
  const pb = b.replace(/^v/i, '').split('.').map((s) => Number.parseInt(s, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

/** 读取远程更新清单；网络/解析失败抛错（调用方捕获并展示“检查失败”） */
export async function fetchUpdateManifest(): Promise<UpdateManifest> {
  const res = await fetch(UPDATE_MANIFEST_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`更新服务 HTTP ${res.status}`);
  const raw: unknown = await res.json();
  if (!raw || typeof raw !== 'object') throw new Error('更新清单格式错误');
  const o = raw as Record<string, unknown>;
  if (typeof o.latestVersion !== 'string' || typeof o.apkUrl !== 'string') {
    throw new Error('更新清单缺少 latestVersion / apkUrl');
  }
  return {
    latestVersion: o.latestVersion,
    apkUrl: o.apkUrl,
    sha256: typeof o.sha256 === 'string' ? o.sha256 : undefined,
    notes: typeof o.notes === 'string' ? o.notes : undefined,
  };
}

/** 检查更新：返回比 currentVersion 新的版本信息；已最新返回 null */
export async function checkForUpdate(currentVersion: string): Promise<UpdateManifest | null> {
  const manifest = await fetchUpdateManifest();
  if (compareVersions(manifest.latestVersion, currentVersion) > 0) return manifest;
  return null;
}

/** 复制文本到剪贴板（失败时静默忽略） */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
