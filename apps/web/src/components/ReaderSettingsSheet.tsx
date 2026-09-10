/**
 * 阅读区设置底部浮层（第 2 步 · 面板层重构）：
 *   主层 — 严格 5 行：亮度 / 字号 / 颜色 / 翻页 / 底部按钮
 *     · 亮度：纯轨道 + 圆滑块；右侧「护眼模式」按钮（在 米黄 #F5F1E6 ⇄ 白 之间切换）
 *     · 字号：A− [当前 px] A+；右侧「字体名 ›」入口 → 字体子层
 *     · 颜色：7 个圆色块（white/sepia/green/blue/pink/gray/dark），选中加黑描边
 *     · 翻页：5 胶囊（仿真/覆盖/平移/上下/无动画），选中态 = 白底黑字 + 番茄橙描边（第 3 轮）
 *     · 底部：圆角矩形「间距设置」+ 文字按钮「更多 ›」
 *
 *   子层（复用 .reader-more-layer / .reader-more-sheet + reader-sheet-bg-${bg} 主题类）：
 *     · ReaderFontSheet：字体（宋体/黑体/楷体/等宽）
 *     · ReaderSpacingSheet：行段间距(4 档) + 页面边距(4 档) + 对齐 —— 均默认「适中」，
 *       选中态 = 番茄橙底白字（第 3 轮：删「自定义」滑块与「智能匹配」）
 *     · ReaderMoreSheet：展示进度时间和电量 / 手机状态栏常驻（严格 2 个开关，
 *       第 3 轮删「单手模式」）
 *
 *   面板底色：浅色主题（white/sepia/green/blue/pink）统一纯白 #FFFFFF；dark/gray 保持深色面
 *   （白底在深色阅读背景上刺眼，属必要偏离）。全部只作用于阅读区；离开阅读页即销毁。
 */
import { useEffect, useState } from 'react';
import type {
  AlignPref,
  AnimationPref,
  BgColorPref,
  FontFamilyPref,
  ReaderPrefs,
} from '../lib/preferences';
import { READ_FONT_MAX, READ_FONT_MIN } from '../lib/preferences';

interface ReaderSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  prefs: ReaderPrefs;
  onChange: <K extends keyof ReaderPrefs>(key: K, value: ReaderPrefs[K]) => void;
  onOpenChapter?: () => void;
  onToggleNight?: () => void;
  isNight?: boolean;
}

// 字体：项目实际可用的 4 款（不引「方正悠黑」等无授权/无内置字体）。
const FAMILY_OPTIONS: { value: FontFamilyPref; label: string }[] = [
  { value: 'serif', label: '宋体' },
  { value: 'sans', label: '黑体' },
  { value: 'kai', label: '楷体' },
  { value: 'mono', label: '等宽' },
];
const FAMILY_LABEL: Record<FontFamilyPref, string> = {
  serif: '宋体',
  sans: '黑体',
  kai: '楷体',
  mono: '等宽',
};

// 颜色 = 主题：7 个圆色块（顺序即 UI 顺序）
const COLOR_SWATCH: Array<{ value: BgColorPref; label: string; color: string }> = [
  { value: 'white', label: '白', color: '#FFFFFF' },
  { value: 'sepia', label: '米黄', color: '#F5F1E6' },
  { value: 'green', label: '护眼', color: '#CFE3D3' },
  { value: 'blue', label: '蓝灰', color: '#DDE6F0' },
  { value: 'pink', label: '浅粉', color: '#F6E4E4' },
  // 第 3 轮：深色两档改为「灰底」——gray 中灰 #888888（配深字）、dark 深灰 #555555（配浅字）
  { value: 'gray', label: '中灰', color: '#888888' },
  { value: 'dark', label: '深灰', color: '#555555' },
];

// 翻页：5 胶囊并排（所有 5 种均有 CSS 支持——见 .reader-doc[data-anim]）
const ANIM_OPTIONS: Array<{ value: AnimationPref; label: string }> = [
  { value: 'simulation', label: '仿真' },
  { value: 'cover', label: '覆盖' },
  { value: 'slide', label: '平移' },
  { value: 'vertical', label: '上下' },
  { value: 'none', label: '无动画' },
];

// 对齐：两端对齐 / 左对齐（第 2 步从主层迁到间距子层）
const ALIGN_OPTIONS: Array<{ value: AlignPref; label: string }> = [
  { value: 'justify', label: '两端对齐' },
  { value: 'left', label: '左对齐' },
];

// 间距设置：行段间距 4 档（第 3 轮：删「自定义」及其滑块，默认「适中」）
const PARA_SPACING_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'xs', label: '小' },
  { value: 'sm', label: '较小' },
  { value: 'md', label: '适中' },
  { value: 'lg', label: '大' },
];
// 间距设置：页面边距 4 档（第 3 轮：删「智能匹配」，默认回到「适中」md）
const PAGE_MARGIN_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'sm', label: '小' },
  { value: 'md', label: '适中' },
  { value: 'lg', label: '较大' },
  { value: 'xl', label: '大' },
];

// 更多设置：严格 2 个开关（第 3 轮：删「单手模式」，仅保留进度信息 / 状态栏常驻）
const MORE_TOGGLE_KEYS = ['progress', 'statusbar'] as const;
type MoreToggleKey = (typeof MORE_TOGGLE_KEYS)[number];
const MORE_TOGGLE_LABELS: Record<MoreToggleKey, { label: string; hint: string }> = {
  progress: { label: '展示进度时间和电量', hint: '阅读页底部显示进度 / 时间 / 电量' },
  statusbar: { label: '手机状态栏常驻', hint: '显示后台程序、通知、信号等' },
};

export function ReaderSettingsSheet({
  open,
  onClose,
  prefs,
  onChange,
}: ReaderSettingsSheetProps): JSX.Element | null {
  const [fontOpen, setFontOpen] = useState<boolean>(false);
  const [spacingOpen, setSpacingOpen] = useState<boolean>(false);
  const [moreOpen, setMoreOpen] = useState<boolean>(false);
  if (!open) return null;

  const bg = prefs.bgColor; // 'white' | 'sepia' | 'green' | 'blue' | 'pink' | 'gray' | 'dark'
  const level = prefs.brightnessLevel;
  const canFontDown = prefs.fontSize > READ_FONT_MIN;
  const canFontUp = prefs.fontSize < READ_FONT_MAX;

  return (
    <div className="reader-sheet-layer" data-control="sheet">
      <div className="reader-sheet-mask" onClick={onClose} />
      <div className={`reader-sheet reader-sheet-bg-${bg}`} role="dialog" aria-label="阅读设置">
        <div className="reader-sheet-handle" aria-hidden="true" />
        <h3 className="reader-sheet-title">阅读设置</h3>

        <div className="reader-sheet-body">
          {/* 亮度：纯灰轨道 + 圆滑块；右侧「护眼模式」（在 米黄 ⇄ 白 间切换）。 */}
          <div className="reader-row">
            <span className="reader-row-label">亮度</span>
            <div className="reader-row-control reader-row-control-grow">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                className="reader-brightness-slider"
                value={level}
                aria-label="App 显示亮度（不影响系统亮度）"
                onChange={(e) => onChange('brightnessLevel', Number(e.target.value))}
              />
              <button
                type="button"
                className={`reader-eye-btn${prefs.bgColor === 'sepia' ? ' is-on' : ''}`}
                aria-label="护眼模式"
                aria-pressed={prefs.bgColor === 'sepia'}
                onClick={() => onChange('bgColor', prefs.bgColor === 'sepia' ? 'white' : 'sepia')}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
                <span className="reader-eye-label">护眼模式</span>
              </button>
            </div>
          </div>

          {/* 字号：A− [当前 px] A+；右侧「字体名 ›」入口。 */}
          <div className="reader-row">
            <span className="reader-row-label">字号</span>
            <div className="reader-row-control reader-row-control-grow">
              <div className="reader-font-size">
                <button
                  type="button"
                  className="reader-font-step"
                  aria-label="缩小字号"
                  disabled={!canFontDown}
                  onClick={() => canFontDown && onChange('fontSize', Math.max(READ_FONT_MIN, prefs.fontSize - 1))}
                >
                  A−
                </button>
                <span className="reader-font-num">{prefs.fontSize}</span>
                <button
                  type="button"
                  className="reader-font-step"
                  aria-label="放大字号"
                  disabled={!canFontUp}
                  onClick={() => canFontUp && onChange('fontSize', Math.min(READ_FONT_MAX, prefs.fontSize + 1))}
                >
                  A+
                </button>
              </div>
              <button
                type="button"
                className="reader-enter-btn"
                aria-label="选择字体"
                onClick={() => setFontOpen(true)}
              >
                <span className="reader-enter-text">{FAMILY_LABEL[prefs.fontFamily]}</span>
                <span className="reader-enter-arrow" aria-hidden="true">
                  ›
                </span>
              </button>
            </div>
          </div>

          {/* 颜色：7 个圆色块 = 主题（背景 + 前景统一）。 */}
          <div className="reader-row">
            <span className="reader-row-label">颜色</span>
            <div className="reader-row-control">
              <div className="reader-color-row">
                {COLOR_SWATCH.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`reader-color-dot${prefs.bgColor === c.value ? ' is-on' : ''}`}
                    style={{ background: c.color }}
                    aria-label={`${c.label}主题`}
                    aria-pressed={prefs.bgColor === c.value}
                    onClick={() => onChange('bgColor', c.value)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 翻页：5 胶囊并排（面板内专属配色，不动全局 .reader-pill）。 */}
          <div className="reader-row">
            <span className="reader-row-label">翻页</span>
            <div className="reader-row-control">
              {/* 第 3 轮：翻页选中态 = 白底黑字 + 番茄橙描边 */}
              <div className="reader-pill-group reader-pill-group-5 reader-pills-tone reader-pills-tone-page">
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

          {/* 底部：间距设置（主按钮）+ 更多（文本入口）。 */}
          <div className="reader-sheet-actions">
            <button type="button" className="reader-action-primary" onClick={() => setSpacingOpen(true)}>
              间距设置
            </button>
            <button type="button" className="reader-action-more" onClick={() => setMoreOpen(true)}>
              更多 ›
            </button>
          </div>
        </div>

        {fontOpen ? (
          <ReaderFontSheet
            bg={bg}
            fontFamily={prefs.fontFamily}
            onPick={(v) => {
              onChange('fontFamily', v);
              setFontOpen(false);
            }}
            onClose={() => setFontOpen(false)}
          />
        ) : null}
        {spacingOpen ? (
          <ReaderSpacingSheet
            bg={bg}
            align={prefs.align}
            onAlignChange={(v) => onChange('align', v)}
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
/*  字体子层                                                            */
/* ------------------------------------------------------------------ */

interface ReaderFontSheetProps {
  bg: BgColorPref;
  fontFamily: FontFamilyPref;
  onPick: (v: FontFamilyPref) => void;
  onClose: () => void;
}

/** 字体子层：4 款实际可用字体，选中即应用并收起。 */
function ReaderFontSheet({ bg, fontFamily, onPick, onClose }: ReaderFontSheetProps): JSX.Element {
  return (
    <div className="reader-more-layer">
      <div className="reader-more-mask" onClick={onClose} />
      <div className={`reader-more-sheet reader-sheet-bg-${bg}`} role="dialog" aria-label="字体">
        <div className="reader-more-head">
          <button type="button" className="reader-more-close" aria-label="收起" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h3 className="reader-more-title">字体</h3>
        </div>

        <div className="reader-spacing-body">
          <div className="reader-pill-group reader-pill-group-4">
            {FAMILY_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`reader-pill${fontFamily === o.value ? ' is-on' : ''}`}
                onClick={() => onPick(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  间距设置子层                                                        */
/* ------------------------------------------------------------------ */

interface ReaderSpacingSheetProps {
  bg: BgColorPref;
  align: AlignPref;
  onAlignChange: (v: AlignPref) => void;
  onClose: () => void;
}

/**
 * 间距设置子层：
 *   - 行段间距：小/较小/适中(默认)/大/自定义（自定义 → 出现真实滑块 0.5–2.5em）
 *   - 页面边距：小/适中/较大/大/智能匹配(默认)（智能匹配 → padding-inline clamp）
 *   - 对齐：两端对齐 / 左对齐（自第 2 步从主层迁入）
 * 选中状态写 localStorage + 立刻落到 html data-attr → CSS 即时生效。
 */
function ReaderSpacingSheet({ bg, align, onAlignChange, onClose }: ReaderSpacingSheetProps): JSX.Element {
  // 第 3 轮：均为 4 档，默认「适中」（页面边距由 smart 改回 md）
  const [paraSpacing, setParaSpacing] = useLocalFlag('pks_pref_read_paraspacing', 'md');
  const [pageMargin, setPageMargin] = useLocalFlag('pks_pref_read_pagemargin', 'md');

  // 行段间距 / 页面边距 写到 :root data-attr，CSS 通过 html[data-*] 消费。
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
          {/* 行段间距：4 档（第 3 轮：删「自定义」及其滑块），选中橙底白字 */}
          <div className="reader-spacing-group">
            <div className="reader-spacing-label">行段间距</div>
            <div className="reader-pill-group reader-pill-group-4 reader-pills-tone reader-pills-tone-orange">
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

          {/* 页面边距：4 档（第 3 轮：删「智能匹配」，默认「适中」） */}
          <div className="reader-spacing-group">
            <div className="reader-spacing-label">页面边距</div>
            <div className="reader-pill-group reader-pill-group-4 reader-pills-tone reader-pills-tone-orange">
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

          {/* 对齐：两端对齐 / 左对齐（自第 2 步从主层迁入），选中橙底白字 */}
          <div className="reader-spacing-group">
            <div className="reader-spacing-label">对齐</div>
            <div className="reader-pill-group reader-pills-tone reader-pills-tone-orange">
              {ALIGN_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`reader-pill${align === o.value ? ' is-on' : ''}`}
                  onClick={() => onAlignChange(o.value)}
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
/*  更多设置子层（严格 3 个开关）                                        */
/* ------------------------------------------------------------------ */

interface ReaderMoreSheetProps {
  bg: BgColorPref;
  prefs: ReaderPrefs;
  onChange: <K extends keyof ReaderPrefs>(key: K, value: ReaderPrefs[K]) => void;
  onClose: () => void;
}

/**
 * 更多设置子层（严格 3 个开关）：
 *   单手模式（本地存储）/ 展示进度时间和电量（prefs.showProgress）/
 *   手机状态栏常驻（prefs.statusbarPermanent）。
 *   - 「手机状态栏常驻」走 ReaderPrefs：EntryReaderPage 的 effect 会立刻同步原生层。
 *   - 「展示进度时间和电量」走 ReaderPrefs：控制底部信息条是否渲染。
 *   - 已删除「音量键翻页 / 锁屏继续翻页 / 滚动到底自动翻章」三行 UI
 *     （autoLoad 仍被 EntryReaderPage 消费，故保留字段，仅删 UI）。
 */
function ReaderMoreSheet({ bg, prefs, onChange, onClose }: ReaderMoreSheetProps): JSX.Element {
  const [flags, setFlags] = useState<Record<MoreToggleKey, boolean>>(() => ({
    progress: prefs.showProgress,
    statusbar: prefs.statusbarPermanent,
  }));

  const toggle = (k: MoreToggleKey): void => {
    setFlags((prev) => {
      const next = !prev[k];
      if (k === 'progress') {
        onChange('showProgress', next);
      } else {
        onChange('statusbarPermanent', next);
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
