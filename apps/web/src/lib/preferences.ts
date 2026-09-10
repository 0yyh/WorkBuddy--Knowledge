/**
 * 偏好（设置页）：两套作用域，键名真正隔离
 *  - 系统（pks_pref_sys_*）：全 App 字号 / 字体 / 背景 / 页面过渡动画（仅「设置-系统」消费）
 *  - 阅读区（pks_pref_read_*）：正文阅读页 / 阅读场景（仅阅读区设置弹层 + 封面阅读区消费）
 * 写入永远只写各自命名空间键；旧版 V1 单套键名（pks_pref_fontSize 等）仅在
 * 「读不到新键」时回退读取，用于老用户平滑迁移，且不会反过来污染系统键。
 */
export type FontSizePref = 'sm' | 'md' | 'lg' | 'xl';
export type FontFamilyPref = 'serif' | 'sans' | 'kai' | 'mono';
/** 阅读区主题色板（7 色）：色板顺序即 UI 顺序。sepia（米黄）为默认。 */
export type BgColorPref = 'white' | 'sepia' | 'green' | 'blue' | 'pink' | 'gray' | 'dark';
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
  /**
   * 阅读区正文字号（px，12–30 整数）。**区别于**系统字号 `SysPrefs.fontSize`（枚举）。
   * 数值化后由 `--reading-font-scale = fontSize / 17` 驱动 em 级联（基准 17px → 默认 20px）。
   */
  fontSize: number;
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
  /** 底部常驻信息条（进度 + 时间 + 电量）是否显示。默认 true（缺失即显示）。 */
  showProgress: boolean;
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
  showProgress: 'pks_pref_read_showProgress',
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
  fontSize: 20,
  fontFamily: 'serif',
  bgColor: 'sepia',
  animation: 'slide',
  lineHeight: 'normal',
  brightnessLevel: 70,
  statusbarPermanent: true,
  align: 'justify',
  autoLoad: true,
  showProgress: true,
};

/** 阅读区字号（px）取值边界与默认值（供 UI 复用）。 */
export const READ_FONT_MIN = 12;
export const READ_FONT_MAX = 30;
/** 正文默认字号（第 3 轮：18 → 20，对齐番茄阅读页观感；范围仍 12–30）。 */
export const READ_FONT_DEFAULT = 20;

/**
 * 阅读字号「粗档」：供设置页 / 旧面板这类 4 档 UI 复用（数值化的临时兼容层）。
 * 第 2 步面板重写为连续步进后，此粗档映射即可退役。
 */
export const READ_FONT_BUCKETS = [
  { value: 15, label: '小' },
  { value: 18, label: '默认' },
  { value: 21, label: '大' },
  { value: 24, label: '特大' },
] as const;

/**
 * number(px) → 最近粗档下标：≤16→0 / ≤20→1 / ≤22→2 / 其余→3。
 * 注：第 3 轮把正文默认字号提到 20px，故「默认」档（index 1）的上界由 19 放宽到 20，
 *     保证设置页在默认值 20px 时高亮的仍是「默认」而不是「大」。
 */
export function readFontBucketIndex(px: number): number {
  if (px <= 16) return 0;
  if (px <= 20) return 1;
  if (px <= 22) return 2;
  return 3;
}

/**
 * 阅读字号解析：兼容老值迁移。
 *  - 旧枚举 'sm'|'md'|'lg'|'xl' → 15 / 17 / 20 / 23（仅「尽量接近原视觉」；18 才是新默认）
 *  - 数字字符串 → 夹取到 [READ_FONT_MIN, READ_FONT_MAX] 的整数
 *  - 其它（null / 非法）→ READ_FONT_DEFAULT
 */
function parseReadFontSize(raw: string | null): number {
  if (raw == null) return READ_FONT_DEFAULT;
  const legacy: Record<string, number> = { sm: 15, md: 17, lg: 20, xl: 23 };
  if (Object.prototype.hasOwnProperty.call(legacy, raw)) return legacy[raw];
  const n = Number(raw);
  if (!Number.isFinite(n)) return READ_FONT_DEFAULT;
  return Math.max(READ_FONT_MIN, Math.min(READ_FONT_MAX, Math.round(n)));
}

/** 【系统字号】档位 → 缩放系数（系统基准 15px）。阅读区字号已数值化，不再使用此表。 */
export const FONT_SCALE: Record<FontSizePref, string> = {
  sm: '0.9',
  md: '1',
  lg: '1.15',
  xl: '1.3',
};

/** 阅读区行距系数（.prose 基准 1.8） */
export const LINE_HEIGHT_SCALE: Record<LineHeightPref, string> = {
  tight: '1.45',
  compact: '1.65',
  normal: '1.8',
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
const BG_COLORS: BgColorPref[] = ['white', 'sepia', 'green', 'blue', 'pink', 'gray', 'dark'];
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
    // 阅读字号已数值化：解析老枚举迁移 + 夹取区间（见 parseReadFontSize）。
    fontSize: parseReadFontSize(readItem(store, READ_KEYS.fontSize, V1_READ_KEYS.fontSize)),
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
    // 兼容历史误存的 'true'/'false'；键缺失时回退默认（第 2 步：默认改为 true）。
    statusbarPermanent: readBoolWithDefault(
      store.getItem(READ_KEYS.statusbarPermanent),
      READ_DEFAULTS.statusbarPermanent,
    ),
    align: pick(store.getItem(READ_KEYS.align), ALIGNS, READ_DEFAULTS.align),
    autoLoad: readBoolWithDefault(store.getItem(READ_KEYS.autoLoad), READ_DEFAULTS.autoLoad),
    // 底部信息条：缺失即开（默认 true）。
    showProgress: readBoolWithDefault(store.getItem(READ_KEYS.showProgress), READ_DEFAULTS.showProgress),
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
      // 布尔（statusbarPermanent / showProgress）统一存 '1'/'0'，与读取端 === '1' 对齐。
      // 曾误存 'true'/'false'，读取端兼容处理。数值（fontSize / brightnessLevel）存数字串。
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
  // 阅读字号数值化：scale = 字号px / 17（保持 .prose「17px × scale」em 级联不崩，
  // 默认 18px → scale 1.0588 → 实际 18px）。同时给出绝对 px 变量 --reader-fs，
  // 供标题等需要精确 px（默认 22px）的地方使用。
  document.documentElement.style.setProperty('--reading-font-scale', String(prefs.fontSize / 17));
  document.documentElement.style.setProperty('--reader-fs', `${prefs.fontSize}px`);
  document.documentElement.style.setProperty('--rp-lh', LINE_HEIGHT_SCALE[prefs.lineHeight]);
  document.body.dataset.readingFont = prefs.fontFamily;
  document.body.dataset.readingBg = prefs.bgColor;
  document.body.dataset.readingAnim = prefs.animation;
  document.body.dataset.readingAlign = prefs.align;
}

/**
 * 背景色偏好 → 阅读容器 class。
 * 7 个主题**全部显式带类**（含 white → `reading-bg-white`），消除「无类=白」的隐式语义；
 * 这样「默认」（sepia 米黄）与任一主题都由 CSS 变量显式提供，不依赖兜底。
 */
export function bgClassOf(bg: BgColorPref): string {
  return `reading-bg-${bg}`;
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
