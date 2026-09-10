/**
 * 偏好（设置页）：两套作用域，键名真正隔离
 *  - 系统（pks_pref_sys_*）：全 App 字号 / 字体 / 背景 / 页面过渡动画（仅「设置-系统」消费）
 *  - 阅读区（pks_pref_read_*）：正文阅读页 / 阅读场景（仅阅读区设置弹层 + 封面阅读区消费）
 * 写入永远只写各自命名空间键；旧版 V1 单套键名（pks_pref_fontSize 等）仅在
 * 「读不到新键」时回退读取，用于老用户平滑迁移，且不会反过来污染系统键。
 */
export type FontSizePref = 'sm' | 'md' | 'lg' | 'xl';
export type FontFamilyPref = 'serif' | 'sans' | 'kai' | 'mono';
export type BgColorPref = 'white' | 'sepia' | 'green' | 'blue' | 'dark';
export type AnimationPref = 'none' | 'slide' | 'fade' | 'simulation' | 'cover' | 'vertical';
export type LineHeightPref = 'tight' | 'compact' | 'normal' | 'loose';
/** 正文对齐：justify=两端对齐（默认）；left=左对齐 */
export type AlignPref = 'justify' | 'left';
/** 全 App 背景：偏白浅灰 / 纯白 / 米黄 / 黑色 */
export type SysBgPref = 'gray' | 'white' | 'sepia' | 'dark';

export interface SysPrefs {
  fontSize: FontSizePref;
  fontFamily: FontFamilyPref;
  bg: SysBgPref;
  animation: AnimationPref;
}

export interface ReaderPrefs {
  fontSize: FontSizePref;
  fontFamily: FontFamilyPref;
  bgColor: BgColorPref;
  animation: AnimationPref;
  lineHeight: LineHeightPref;
  /** 阅读区亮度：0（最暗）..100（最亮）。0-100 整数，连续可调。 */
  brightnessLevel: number;
  /** 手机状态栏常驻：true=显示系统状态栏；false=沉浸隐藏。仅作用于阅读页。 */
  statusbarPermanent: boolean;
  /** 正文对齐方式：两端对齐 / 左对齐 */
  align: AlignPref;
  /** 滚到章末自动加载下一章（阅读页「更多」开关） */
  autoLoad: boolean;
}

const SYS_KEYS = {
  fontSize: 'pks_pref_sys_fontSize',
  fontFamily: 'pks_pref_sys_fontFamily',
  bg: 'pks_pref_sys_bg',
  animation: 'pks_pref_sys_animation',
} as const;

const READ_KEYS = {
  fontSize: 'pks_pref_read_fontSize',
  fontFamily: 'pks_pref_read_fontFamily',
  bgColor: 'pks_pref_read_bgColor',
  animation: 'pks_pref_read_animation',
  lineHeight: 'pks_pref_read_lineHeight',
  brightness: 'pks_pref_read_brightness',
  brightnessLevel: 'pks_pref_read_brightnessLevel',
  statusbarPermanent: 'pks_pref_read_statusbarPermanent',
  align: 'pks_pref_read_align',
  autoLoad: 'pks_pref_read_autoload',
} as const;

/** V1 遗留键名：仅在新键缺失时回退读取（绝不写入），保证老用户设置无缝迁移 */
const V1_READ_KEYS: Partial<Record<keyof ReaderPrefs, string>> = {
  fontSize: 'pks_pref_fontSize',
  fontFamily: 'pks_pref_fontFamily',
  bgColor: 'pks_pref_bgColor',
  animation: 'pks_pref_animation',
};

export const SYS_DEFAULTS: SysPrefs = {
  fontSize: 'md',
  fontFamily: 'sans',
  bg: 'gray',
  animation: 'slide',
};

export const READ_DEFAULTS: ReaderPrefs = {
  fontSize: 'md',
  fontFamily: 'serif',
  bgColor: 'white',
  animation: 'slide',
  lineHeight: 'normal',
  brightnessLevel: 70,
  statusbarPermanent: false,
  align: 'justify',
  autoLoad: true,
};

/** 字号档位 → 缩放系数（系统基准 15px / 阅读区 .prose 基准 16px） */
export const FONT_SCALE: Record<FontSizePref, string> = {
  sm: '0.9',
  md: '1',
  lg: '1.15',
  xl: '1.3',
};

/** 阅读区行距系数（.prose 基准 1.85） */
export const LINE_HEIGHT_SCALE: Record<LineHeightPref, string> = {
  tight: '1.45',
  compact: '1.65',
  normal: '1.85',
  loose: '2.08',
};

/**
 * 阅读区亮度（连续档）：黑色遮罩压暗 + CSS filter 提亮，仅作用于阅读区，不影响系统亮度。
 *  - level 0   → 暗到极：veil 0.6
 *  - level 70（默认）→ 自然：veil 0，filter 1
 *  - level 100 → 亮到极：veil 0，filter 1.18
 *
 * 合成优化（重要）：压暗【只】用黑色遮罩（opacity 合成，不触发重绘），filter 仅用于
 * level > 70 的「提亮」（遮罩无法提亮）。这样滚动内容绝大多数时候不处于 filter 层内，
 * 滚动不再每帧重新栅格化 → 顺滑。返回值用于 .reader-veil 的 opacity。
 */
export function brightnessVeil(level: number): number {
  // 0..70 线性压暗：level 70 → 0，level 0 → 0.6；70..100 不压暗（交给 filter 提亮）
  if (level >= 70) return 0;
  return ((70 - level) / 70) * 0.6;
}

/** 提亮系数：仅当 > 1 时才会被 EntryReaderPage 用作 CSS filter（压暗不走 filter） */
export function brightnessFilter(level: number): string {
  // 0 → 0.7；50 → 0.95；70 → 1.0；100 → 1.18
  const t = Math.max(0, Math.min(100, level)) / 100;
  return (0.7 + 0.48 * t).toFixed(3);
}

const FONT_SIZES: FontSizePref[] = ['sm', 'md', 'lg', 'xl'];
const FONT_FAMILIES: FontFamilyPref[] = ['serif', 'sans', 'kai', 'mono'];
const BG_COLORS: BgColorPref[] = ['white', 'sepia', 'green', 'blue', 'dark'];
const ANIMATIONS: AnimationPref[] = ['none', 'slide', 'fade', 'simulation', 'cover', 'vertical'];
const LINE_HEIGHTS: LineHeightPref[] = ['tight', 'compact', 'normal', 'loose'];
const ALIGNS: AlignPref[] = ['justify', 'left'];
const SYS_BGS: SysBgPref[] = ['gray', 'white', 'sepia', 'dark'];

function pick<T extends string>(raw: string | null, allowed: T[], fallback: T): T {
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

/** 优先读新键；新键缺失时回退读 V1 旧键 */
function readItem(store: Storage, key: string, legacyKey?: string): string | null {
  const current = store.getItem(key);
  if (current != null) return current;
  return legacyKey ? store.getItem(legacyKey) : null;
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/* ------------------------------- 系统偏好 ------------------------------- */

/** 读取系统偏好（非法值回退默认） */
export function readSysPrefs(): SysPrefs {
  const store = safeStorage();
  if (!store) return { ...SYS_DEFAULTS };
  return {
    fontSize: pick(store.getItem(SYS_KEYS.fontSize), FONT_SIZES, SYS_DEFAULTS.fontSize),
    fontFamily: pick(store.getItem(SYS_KEYS.fontFamily), FONT_FAMILIES, SYS_DEFAULTS.fontFamily),
    bg: pick(store.getItem(SYS_KEYS.bg), SYS_BGS, SYS_DEFAULTS.bg),
    animation: pick(store.getItem(SYS_KEYS.animation), ANIMATIONS, SYS_DEFAULTS.animation),
  };
}

/** 写入单项系统偏好并应用 */
export function writeSysPref<K extends keyof SysPrefs>(key: K, value: SysPrefs[K]): SysPrefs {
  const store = safeStorage();
  if (store) {
    try {
      store.setItem(SYS_KEYS[key], value);
    } catch {
      /* 隐私模式写失败：忽略，仅本次会话生效 */
    }
  }
  const prefs = readSysPrefs();
  applySysPrefs(prefs);
  return prefs;
}

/** 把系统偏好写入 DOM：CSS 变量 + data-* 属性 */
export function applySysPrefs(prefs: SysPrefs): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--sys-font-scale', FONT_SCALE[prefs.fontSize]);
  document.body.dataset.sysFont = prefs.fontFamily;
  document.body.dataset.sysBg = prefs.bg;
  document.body.dataset.sysAnim = prefs.animation;
}

/* ------------------------------- 阅读区偏好 ------------------------------- */

/** 读取阅读区偏好（非法值回退默认；新键缺失时回退 V1 旧键） */
export function readReadPrefs(): ReaderPrefs {
  const store = safeStorage();
  if (!store) return { ...READ_DEFAULTS };
  return {
    fontSize: pick(
      readItem(store, READ_KEYS.fontSize, V1_READ_KEYS.fontSize),
      FONT_SIZES,
      READ_DEFAULTS.fontSize,
    ),
    fontFamily: pick(
      readItem(store, READ_KEYS.fontFamily, V1_READ_KEYS.fontFamily),
      FONT_FAMILIES,
      READ_DEFAULTS.fontFamily,
    ),
    bgColor: pick(
      readItem(store, READ_KEYS.bgColor, V1_READ_KEYS.bgColor),
      BG_COLORS,
      READ_DEFAULTS.bgColor,
    ),
    animation: pick(
      readItem(store, READ_KEYS.animation, V1_READ_KEYS.animation),
      ANIMATIONS,
      READ_DEFAULTS.animation,
    ),
    lineHeight: pick(store.getItem(READ_KEYS.lineHeight), LINE_HEIGHTS, READ_DEFAULTS.lineHeight),
    brightnessLevel: clampLevel(
      // 旧版离散 brightness 迁移：dim→33 / normal→66 / bright→100
      store.getItem(READ_KEYS.brightnessLevel) ??
        legacyBrightnessToLevel(store.getItem(READ_KEYS.brightness)),
      READ_DEFAULTS.brightnessLevel,
    ),
    // 兼容历史误存的 'true'/'false'
    statusbarPermanent:
      store.getItem(READ_KEYS.statusbarPermanent) === '1' ||
      store.getItem(READ_KEYS.statusbarPermanent) === 'true',
    align: pick(store.getItem(READ_KEYS.align), ALIGNS, READ_DEFAULTS.align),
    autoLoad: readBoolWithDefault(store.getItem(READ_KEYS.autoLoad), READ_DEFAULTS.autoLoad),
  };
}

/** 旧版离散 brightness 字符串 → 新版连续等级 0-100；用于老用户平滑迁移。 */
function legacyBrightnessToLevel(raw: string | null): string | null {
  if (raw === 'dim') return '33';
  if (raw === 'bright') return '100';
  if (raw === 'normal') return '66';
  return null;
}

function clampLevel(raw: string | null | undefined, fallback: number): number {
  const n = raw === null || raw === undefined ? NaN : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** 布尔偏好读取：'1'/'true' → true；'0'/'false' → false；缺失 → fallback */
function readBoolWithDefault(raw: string | null, fallback: boolean): boolean {
  if (raw === null) return fallback;
  return raw === '1' || raw === 'true';
}

/** 写入单项阅读区偏好并应用 */
export function writeReadPref<K extends keyof ReaderPrefs>(
  key: K,
  value: ReaderPrefs[K],
): ReaderPrefs {
  const store = safeStorage();
  if (store) {
    try {
      // 布尔（仅 statusbarPermanent）统一存 '1'/'0'，与读取端 === '1' 对齐。
      // 曾误存 'true'/'false'，读取端兼容处理。
      const serialized = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
      store.setItem(READ_KEYS[key], serialized);
    } catch {
      /* ignore */
    }
  }
  const prefs = readReadPrefs();
  applyReadPrefs(prefs);
  return prefs;
}

/** 把阅读区偏好写入 DOM：CSS 变量 + data-* 属性（仅 .prose 等阅读场景消费） */
export function applyReadPrefs(prefs: ReaderPrefs): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--reading-font-scale', FONT_SCALE[prefs.fontSize]);
  document.documentElement.style.setProperty('--rp-lh', LINE_HEIGHT_SCALE[prefs.lineHeight]);
  document.body.dataset.readingFont = prefs.fontFamily;
  document.body.dataset.readingBg = prefs.bgColor;
  document.body.dataset.readingAnim = prefs.animation;
  document.body.dataset.readingAlign = prefs.align;
}

/** 背景色偏好 → 阅读容器 class（.entry-cover / .reader-view 上叠加） */
export function bgClassOf(bg: BgColorPref): string {
  return bg === 'white' ? '' : `reading-bg-${bg}`;
}

/* ------------------------------- 兼容别名（V1 API） ------------------------------- */

/** 兼容旧调用：读取即阅读区偏好 */
export const readPrefs: () => ReaderPrefs = readReadPrefs;

/** 兼容旧调用：写入阅读区偏好 */
export const writePref = writeReadPref;

/** 兼容旧调用：应用阅读区偏好 */
export const applyPrefs = applyReadPrefs;

/** 一次性应用两套偏好（App 冷启动调用） */
export function applyAllPrefs(): void {
  applySysPrefs(readSysPrefs());
  applyReadPrefs(readReadPrefs());
}
