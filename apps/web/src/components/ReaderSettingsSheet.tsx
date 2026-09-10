/**
 * 阅读区设置底部浮层（参考 11.jpg 番茄小说风格）：
 *   顶部行 = 左标签 + 右侧横向选择
 *     亮度：一根可滑动调节的滑杆（连续等级 0-100），只调节 App 显示亮度，不影响系统亮度
 *     字号：A- 数字 A+
 *     字体：横向轮播胶囊（宋体/黑体/楷体/等宽）
 *     颜色：圆形色板（同时也是"背景"——一个色板 = 背景+前景统一主题）
 *     翻页：5 个胶囊并排（仿真/覆盖/平移/上下/无动画）
 *     其他：间距设置 / 更多 ▾（分别打开两个独立子层）
 *
 * 子层：
 *   - ReaderSpacingSheet：行段间距 + 页面边距
 *   - ReaderMoreSheet：单手模式 / 音量键翻页 / 锁屏继续翻页 / 手机状态栏常驻
 *
 * 设置弹层底部**没有** 目录/夜间/设置 工具行（@3.jpg 标注要求删除）。
 * 全部只作用于阅读区；离开阅读页即销毁——不影响系统亮度。
 */
import { useEffect, useState } from 'react';
import type {
  AlignPref,
  AnimationPref,
  BgColorPref,
  FontFamilyPref,
  FontSizePref,
  LineHeightPref,
  ReaderPrefs,
} from '../lib/preferences';

interface ReaderSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  prefs: ReaderPrefs;
  onChange: <K extends keyof ReaderPrefs>(key: K, value: ReaderPrefs[K]) => void;
  onOpenChapter?: () => void;
  onToggleNight?: () => void;
  isNight?: boolean;
}

// 字号：4 档
const FONT_SIZE_LIST: FontSizePref[] = ['sm', 'md', 'lg', 'xl'];
const FONT_SIZE_LABEL: Record<FontSizePref, string> = { sm: '小', md: '默认', lg: '大', xl: '特大' };

// 字体：横向轮播胶囊
const FAMILY_OPTIONS: { value: FontFamilyPref; label: string }[] = [
  { value: 'serif', label: '宋体' },
  { value: 'sans', label: '黑体' },
  { value: 'kai', label: '楷体' },
  { value: 'mono', label: '等宽' },
];

// 颜色 = 主题：5 个圆形色板（同时控制背景与前景色——参考 11.jpg）
const COLOR_SWATCH: Array<{ value: BgColorPref; label: string; color: string; ring?: boolean }> = [
  { value: 'white', label: '白', color: '#ffffff' },
  { value: 'green', label: '护眼', color: '#cfe3d3' },
  { value: 'sepia', label: '米黄', color: '#f5ecd9' },
  { value: 'blue', label: '蓝灰', color: '#dde6f0' },
  { value: 'dark', label: '深色', color: '#1c1c1c', ring: true },
];

// 翻页：5 胶囊并排（所有 5 种都需 CSS 支持——见 .reader-doc[data-anim]）
const ANIM_OPTIONS: Array<{ value: AnimationPref; label: string }> = [
  { value: 'simulation', label: '仿真' },
  { value: 'cover', label: '覆盖' },
  { value: 'slide', label: '平移' },
  { value: 'vertical', label: '上下' },
  { value: 'none', label: '无动画' },
];

// 对齐：两端对齐 / 左对齐
const ALIGN_OPTIONS: Array<{ value: AlignPref; label: string }> = [
  { value: 'justify', label: '两端对齐' },
  { value: 'left', label: '左对齐' },
];

// 行距：4 档（间距设置子层使用）
const LINE_OPTIONS: Array<{ value: LineHeightPref; label: string }> = [
  { value: 'tight', label: '紧凑' },
  { value: 'compact', label: '紧凑' },
  { value: 'normal', label: '适中' },
  { value: 'loose', label: '宽松' },
];

// 间距设置：行段间距 4 档 + 页面边距 4 档（参考 12.jpg；已按要求移除"自定义"）
const PARA_SPACING_OPTIONS: Array<{ value: string; label: string; rem: string }> = [
  { value: 'xs', label: '小', rem: '0.5rem' },
  { value: 'sm', label: '较小', rem: '0.875rem' },
  { value: 'md', label: '适中', rem: '1.25rem' },
  { value: 'lg', label: '大', rem: '1.625rem' },
];
const PAGE_MARGIN_OPTIONS: Array<{ value: string; label: string; rem: string }> = [
  { value: 'sm', label: '小', rem: '0.5rem' },
  { value: 'md', label: '适中', rem: '1rem' },
  { value: 'lg', label: '较大', rem: '1.5rem' },
  { value: 'xl', label: '大', rem: '2rem' },
];

// 更多设置：4 个开关（删 翻页动效 — 已在主页"翻页"行）
const MORE_TOGGLE_KEYS = ['onehand', 'vkeyturn', 'lockturn', 'statusbar', 'autoload'] as const;
type MoreToggleKey = (typeof MORE_TOGGLE_KEYS)[number];
const MORE_TOGGLE_LABELS: Record<MoreToggleKey, { label: string; hint: string }> = {
  onehand: { label: '单手模式', hint: '点击左右两侧翻下一页' },
  vkeyturn: { label: '音量键翻页', hint: '按音量键翻页（仅 App 内）' },
  lockturn: { label: '锁屏时继续翻页', hint: '仅在自动阅读时生效' },
  statusbar: { label: '手机状态栏常驻', hint: '显示在阅读页面，通知与信息等' },
  autoload: { label: '滚动到底自动翻章', hint: '滚到章节末尾自动加载下一章' },
};
const MORE_TOGGLE_STORAGE: Record<MoreToggleKey, string> = {
  onehand: 'pks_pref_read_onehand',
  vkeyturn: 'pks_pref_read_vkeyturn',
  lockturn: 'pks_pref_read_lockturn',
  statusbar: 'pks_pref_read_statusbar',
  autoload: 'pks_pref_read_autoload',
};

export function ReaderSettingsSheet({ open, onClose, prefs, onChange }: ReaderSettingsSheetProps): JSX.Element | null {
  const [spacingOpen, setSpacingOpen] = useState<boolean>(false);
  const [moreOpen, setMoreOpen] = useState<boolean>(false);
  if (!open) return null;

  const fontSizeIdx = Math.max(0, FONT_SIZE_LIST.indexOf(prefs.fontSize));
  const canFontDown = fontSizeIdx > 0;
  const canFontUp = fontSizeIdx < FONT_SIZE_LIST.length - 1;
  const bg = prefs.bgColor; // 'white' | 'sepia' | 'green' | 'blue' | 'dark'
  const level = prefs.brightnessLevel;

  return (
    <div className="reader-sheet-layer" data-control="sheet">
      <div className="reader-sheet-mask" onClick={onClose} />
      <div className={`reader-sheet reader-sheet-bg-${bg}`} role="dialog" aria-label="阅读设置">
        <div className="reader-sheet-handle" aria-hidden="true" />
        <h3 className="reader-sheet-title">阅读设置</h3>

        <div className="reader-sheet-body">
          {/* 亮度：单根可滑动滑杆（连续 0-100），只调节 App 内显示亮度。 */}
          <div className="reader-row">
            <span className="reader-row-label">亮度</span>
            <div className="reader-row-control reader-row-control-grow">
              {/* P2-10：亮度滑杆两端补 ☾ / ☀ 图标（纯文本符号，不引图标库）。
                  样式内联以保证不依赖 styles.css（该文件当前被 V4 独占锁占用）。 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <span aria-hidden="true" style={{ flex: '0 0 auto', fontSize: 13, opacity: 0.65 }}>☾</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  className="reader-brightness-slider"
                  value={level}
                  aria-label="App 显示亮度（不影响系统亮度）"
                  onChange={(e) => onChange('brightnessLevel', Number(e.target.value))}
                  style={{ flex: '1 1 auto', minWidth: 0 }}
                />
                <span aria-hidden="true" style={{ flex: '0 0 auto', fontSize: 15, opacity: 0.65 }}>☀</span>
              </div>
            </div>
          </div>

          {/* 字号：A- 数字 A+ */}
          <div className="reader-row">
            <span className="reader-row-label">字号</span>
            <div className="reader-row-control reader-row-control-grow">
              <div className="reader-font-size">
                <button
                  type="button"
                  className="reader-font-step"
                  aria-label="缩小字号"
                  disabled={!canFontDown}
                  onClick={() => canFontDown && onChange('fontSize', FONT_SIZE_LIST[fontSizeIdx - 1])}
                >
                  A−
                </button>
                <span className="reader-font-num">{fontSizeIdx + 1}</span>
                <button
                  type="button"
                  className="reader-font-step"
                  aria-label="放大字号"
                  disabled={!canFontUp}
                  onClick={() => canFontUp && onChange('fontSize', FONT_SIZE_LIST[fontSizeIdx + 1])}
                >
                  A+
                </button>
              </div>
              <div className="reader-pill-group reader-pill-group-scroll">
                {FONT_SIZE_LIST.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`reader-pill${prefs.fontSize === v ? ' is-on' : ''}`}
                    onClick={() => onChange('fontSize', v)}
                  >
                    {FONT_SIZE_LABEL[v]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 字体：横向轮播胶囊 */}
          <div className="reader-row">
            <span className="reader-row-label">字体</span>
            <div className="reader-row-control reader-row-control-grow">
              <div className="reader-pill-group reader-pill-group-scroll">
                {FAMILY_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className={`reader-pill reader-pill-text${prefs.fontFamily === o.value ? ' is-on' : ''}`}
                    onClick={() => onChange('fontFamily', o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 对齐：两端对齐 / 左对齐（实时作用于正文 .prose p） */}
          <div className="reader-row">
            <span className="reader-row-label">对齐</span>
            <div className="reader-row-control">
              <div className="reader-pill-group">
                {ALIGN_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className={`reader-pill${prefs.align === o.value ? ' is-on' : ''}`}
                    onClick={() => onChange('align', o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 颜色：5 个圆形色板 = 主题（同时控制背景+前景，删"背景"行避免重复） */}
          <div className="reader-row">
            <span className="reader-row-label">颜色</span>
            <div className="reader-row-control">
              <div className="reader-color-row">
                {COLOR_SWATCH.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`reader-color-dot${prefs.bgColor === c.value ? ' is-on' : ''}${c.ring ? ' reader-color-dark' : ''}`}
                    style={{ background: c.color }}
                    aria-label={`${c.label}主题`}
                    aria-pressed={prefs.bgColor === c.value}
                    onClick={() => onChange('bgColor', c.value)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 翻页：5 胶囊并排（所有 5 种均有 CSS 实现） */}
          <div className="reader-row">
            <span className="reader-row-label">翻页</span>
            <div className="reader-row-control">
              <div className="reader-pill-group reader-pill-group-5">
                {ANIM_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className={`reader-pill${prefs.animation === o.value ? ' is-on' : ''}`}
                    onClick={() => onChange('animation', o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 其他：间距设置（独立子层） + 更多（独立子层） */}
          <div className="reader-row">
            <span className="reader-row-label">其他</span>
            <div className="reader-row-control">
              <div className="reader-pill-group">
                <button type="button" className="reader-pill" onClick={() => setSpacingOpen(true)}>
                  间距设置
                </button>
                <button type="button" className="reader-pill" onClick={() => setMoreOpen(true)}>
                  更多 ▾
                </button>
              </div>
            </div>
          </div>
        </div>
        {/* @3.jpg 标注：删除原"目录/夜间/设置"底部一栏 */}

        {spacingOpen ? (
          <ReaderSpacingSheet
            bg={bg}
            lineHeight={prefs.lineHeight}
            onChangeLine={(v) => onChange('lineHeight', v)}
            onClose={() => setSpacingOpen(false)}
          />
        ) : null}
        {moreOpen ? (
          <ReaderMoreSheet
            bg={bg}
            prefs={prefs}
            onChange={onChange}
            onClose={() => setMoreOpen(false)}
          />
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  间距设置子层（参考 12.jpg）                                         */
/* ------------------------------------------------------------------ */

interface ReaderSpacingSheetProps {
  bg: BgColorPref;
  lineHeight: LineHeightPref;
  onChangeLine: (v: LineHeightPref) => void;
  onClose: () => void;
}

/**
 * 间距设置子层：
 *   - 行段间距：小/较小/适中/大（4 档，无"自定义"）
 *   - 行距（页面级）：紧凑/适中/宽松（在 页面边距 之前）
 *   - 页面边距：小/适中/较大/大（4 档，无"自定义"）
 * 选中状态写 localStorage + 立刻落到 html data-attr → CSS 即时生效。
 */
function ReaderSpacingSheet({ bg, lineHeight, onChangeLine, onClose }: ReaderSpacingSheetProps): JSX.Element {
  const [paraSpacing, setParaSpacing] = useLocalFlag('pks_pref_read_paraspacing', 'md');
  const [pageMargin, setPageMargin] = useLocalFlag('pks_pref_read_pagemargin', 'md');

  // 行段间距 / 页面边距 写到 :root data-attr，CSS 通过 .reader-root[data-paraspacing] 消费
  useEffect(() => {
    document.documentElement.setAttribute('data-paraspacing', paraSpacing);
    document.documentElement.setAttribute('data-pagemargin', pageMargin);
  }, [paraSpacing, pageMargin]);

  return (
    <div className="reader-more-layer">
      <div className="reader-more-mask" onClick={onClose} />
      <div className={`reader-more-sheet reader-sheet-bg-${bg}`} role="dialog" aria-label="间距设置">
        <div className="reader-more-head">
          <button type="button" className="reader-more-close" aria-label="收起" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h3 className="reader-more-title">间距设置</h3>
        </div>

        <div className="reader-spacing-body">
          {/* 行段间距：4 档（已删"自定义"） */}
          <div className="reader-spacing-group">
            <div className="reader-spacing-label">行段间距</div>
            <div className="reader-pill-group reader-pill-group-4">
              {PARA_SPACING_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`reader-pill${paraSpacing === o.value ? ' is-on' : ''}`}
                  onClick={() => setParaSpacing(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* 行距（页面级）：置于 页面边距 之前 */}
          <div className="reader-spacing-group">
            <div className="reader-spacing-label">行距（页面级）</div>
            <div className="reader-pill-group reader-pill-group-4">
              {LINE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`reader-pill${lineHeight === o.value ? ' is-on' : ''}`}
                  onClick={() => onChangeLine(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* 页面边距：4 档（已删"自定义"） */}
          <div className="reader-spacing-group">
            <div className="reader-spacing-label">页面边距</div>
            <div className="reader-pill-group reader-pill-group-4">
              {PAGE_MARGIN_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`reader-pill${pageMargin === o.value ? ' is-on' : ''}`}
                  onClick={() => setPageMargin(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  更多设置子层（参考 13.jpg，删 翻页动效 行）                          */
/* ------------------------------------------------------------------ */

interface ReaderMoreSheetProps {
  bg: BgColorPref;
  prefs: ReaderPrefs;
  onChange: <K extends keyof ReaderPrefs>(key: K, value: ReaderPrefs[K]) => void;
  onClose: () => void;
}

/**
 * 更多设置子层：
 *   4 个开关：单手模式 / 音量键翻页 / 锁屏继续翻页 / 手机状态栏常驻
 *   - 状态走 React useState 立即反映
 *   - 持久化到 localStorage
 *   - "手机状态栏常驻"复用阅读区偏好 prefs.statusbarPermanent（onChange 回调改它）
 *     EntryReaderPage 的 effect 会立刻同步到原生层（隐藏/显示系统状态栏），
 *     离开阅读页时强制恢复显示——避免污染其他页面。
 */
function ReaderMoreSheet({ bg, prefs, onChange, onClose }: ReaderMoreSheetProps): JSX.Element {
  // 4 个开关统一走本地 useState，保证点击立即反映（避免依赖 props 回传时序）。
  const [flags, setFlags] = useState<Record<MoreToggleKey, boolean>>(() => ({
    onehand: readFlag(MORE_TOGGLE_STORAGE.onehand),
    vkeyturn: readFlag(MORE_TOGGLE_STORAGE.vkeyturn),
    lockturn: readFlag(MORE_TOGGLE_STORAGE.lockturn),
    statusbar: prefs.statusbarPermanent,
    autoload: prefs.autoLoad,
  }));

  const toggle = (k: MoreToggleKey): void => {
    setFlags((prev) => {
      const next = !prev[k];
      if (k === 'statusbar') {
        // 状态栏常驻：走 ReaderPrefs（writeReadPref 统一以 '1'/'0' 落盘并返回新 prefs，
        // EntryReaderPage 的 effect 据此调原生显示/隐藏状态栏）。
        onChange('statusbarPermanent', next);
      } else if (k === 'autoload') {
        // 滚动到底自动翻章：走 ReaderPrefs（EntryReaderPage 用 ref 读取 prefs.autoLoad）。
        onChange('autoLoad', next);
      } else {
        writeFlag(MORE_TOGGLE_STORAGE[k], next);
      }
      return { ...prev, [k]: next };
    });
  };

  return (
    <div className="reader-more-layer">
      <div className="reader-more-mask" onClick={onClose} />
      <div className={`reader-more-sheet reader-sheet-bg-${bg}`} role="dialog" aria-label="更多设置">
        <div className="reader-more-head">
          <button type="button" className="reader-more-close" aria-label="收起" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h3 className="reader-more-title">更多设置</h3>
        </div>

        <div className="reader-more-body">
          {MORE_TOGGLE_KEYS.map((k) => (
            <div key={k} className="reader-more-row">
              <div className="reader-more-text">
                <span className="reader-more-label">{MORE_TOGGLE_LABELS[k].label}</span>
                <span className="reader-more-hint">{MORE_TOGGLE_LABELS[k].hint}</span>
                {/* P2-13：单手模式补示意图（左右半屏点按区），让用户看懂"点哪里翻页" */}
                {k === 'onehand' ? (
                  <div
                    style={{
                      marginTop: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      opacity: 0.8,
                    }}
                  >
                    <span
                      style={{
                        flex: '0 0 auto',
                        padding: '5px 8px',
                        border: '1px dashed currentColor',
                        borderRadius: 6,
                      }}
                    >
                      ◀ 左半屏
                    </span>
                    <span
                      style={{
                        flex: '0 0 auto',
                        padding: '5px 8px',
                        border: '1px dashed currentColor',
                        borderRadius: 6,
                      }}
                    >
                      右半屏 ▶
                    </span>
                    <span style={{ flex: '1 1 auto' }}>轻点任一侧即翻页</span>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className={`reader-switch${flags[k] ? ' is-on' : ''}`}
                aria-pressed={flags[k]}
                aria-label={MORE_TOGGLE_LABELS[k].label}
                onClick={() => toggle(k)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  持久化小工具                                                        */
/* ------------------------------------------------------------------ */

function readFlag(key: string): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(key) === '1';
}

function writeFlag(key: string, on: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, on ? '1' : '0');
}

/** React state + 同步到 localStorage 的小工具 */
function useLocalFlag(key: string, fallback: string): [string, (v: string) => void] {
  const [v, setV] = useState<string>(() => {
    if (typeof window === 'undefined') return fallback;
    return window.localStorage.getItem(key) ?? fallback;
  });
  const set = (next: string): void => {
    setV(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, next);
    }
  };
  return [v, set];
}
