/**
 * 设置页 = 两栏分组：
 *  - 系统设置（pks_pref_sys_*）：全 App 字号 / 字体 / 背景 / 页面动画
 *  - 阅读区设置（pks_pref_read_*）：仅详情页 + 正文阅读（.prose 场景）
 * 底部：轻量 OTA「检查更新」+ 数据管理。
 */
import { useState } from 'react';
import {
  ColorSwatches,
  GroupTitle,
  Segmented,
  type SegOption,
  type SwatchOption,
} from '../components/SettingControls';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  READ_FONT_BUCKETS,
  readFontBucketIndex,
  readReadPrefs,
  readSysPrefs,
  writeReadPref,
  writeSysPref,
  type AnimationPref,
  type BgColorPref,
  type FontFamilyPref,
  type FontSizePref,
  type ReaderPrefs,
  type SysBgPref,
  type SysPrefs,
} from '../lib/preferences';
import { clearHistory, clearLastReadSlug } from '../lib/history';

const APP_VERSION = '0.1.0';

// 系统字号：4 档枚举（系统那套，保持不变）
const FONT_OPTIONS: Array<SegOption<FontSizePref>> = [
  { value: 'sm', label: '小' },
  { value: 'md', label: '默认' },
  { value: 'lg', label: '大' },
  { value: 'xl', label: '特大' },
];

// 阅读字号：临时「粗档」映射（value 为像素 px 字符串；第 2 步面板会改为连续步进）。
const READ_FONT_OPTIONS: Array<SegOption<string>> = READ_FONT_BUCKETS.map((b) => ({
  value: String(b.value),
  label: b.label,
}));

const FAMILY_OPTIONS: Array<SegOption<FontFamilyPref>> = [
  { value: 'serif', label: '宋体' },
  { value: 'sans', label: '黑体' },
];

const READ_BG_OPTIONS: Array<SwatchOption<BgColorPref>> = [
  { value: 'white', label: '白', color: '#ffffff' },
  { value: 'sepia', label: '米黄', color: '#f5ecd9' },
  { value: 'green', label: '绿', color: '#cfe3d3' },
  { value: 'dark', label: '深色', color: '#1c1c1c' },
];

const SYS_BG_OPTIONS: Array<SwatchOption<SysBgPref>> = [
  { value: 'gray', label: '浅灰', color: '#f6f7f9' },
  { value: 'white', label: '白', color: '#ffffff' },
  { value: 'sepia', label: '米黄', color: '#faf6ea' },
  { value: 'dark', label: '黑色', color: '#1a1a1a' },
];

const ANIM_OPTIONS: Array<SegOption<AnimationPref>> = [
  { value: 'none', label: '无' },
  { value: 'slide', label: '滑动' },
  { value: 'fade', label: '淡入' },
];

export function SettingsPage(): JSX.Element {
  const [sys, setSys] = useState<SysPrefs>(() => readSysPrefs());
  const [read, setRead] = useState<ReaderPrefs>(() => readReadPrefs());
  const [toast, setToast] = useState<string>('');
  const [confirmKind, setConfirmKind] = useState<'history' | 'lastread' | null>(null);

  const flash = (msg: string): void => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3200);
  };

  const setSysPref = <K extends keyof SysPrefs>(key: K, value: SysPrefs[K]): void => {
    setSys(writeSysPref(key, value));
  };

  const setReadPref = <K extends keyof ReaderPrefs>(key: K, value: ReaderPrefs[K]): void => {
    setRead(writeReadPref(key, value));
  };

  const onClearHistory = (): void => {
    setConfirmKind('history');
  };

  const onClearLastRead = (): void => {
    setConfirmKind('lastread');
  };

  const closeConfirm = (): void => setConfirmKind(null);

  const runClear = (): void => {
    if (confirmKind === 'history') {
      clearHistory();
      flash('已清空阅读历史');
    } else if (confirmKind === 'lastread') {
      clearLastReadSlug();
      flash('已清除续读位置');
    }
    closeConfirm();
  };

  return (
    <div className="page">
      <h1 className="page-title">设置</h1>
      <p className="page-sub">系统设置作用于整个 App；阅读区设置仅在阅读时生效</p>

      <div className="stack">
        <section className="card settings-group">
          <GroupTitle>系统设置 · 全 App 生效</GroupTitle>
          <div className="settings-row">
            <span className="settings-row-label">全局字号</span>
            <Segmented value={sys.fontSize} options={FONT_OPTIONS} onChange={(v) => setSysPref('fontSize', v)} />
          </div>
          <div className="settings-row">
            <span className="settings-row-label">全局字体</span>
            <Segmented value={sys.fontFamily} options={FAMILY_OPTIONS} onChange={(v) => setSysPref('fontFamily', v)} />
          </div>
          <div className="settings-row">
            <span className="settings-row-label">全局背景</span>
            <ColorSwatches value={sys.bg} options={SYS_BG_OPTIONS} onChange={(v) => setSysPref('bg', v)} />
          </div>
          <div className="settings-row">
            <span className="settings-row-label">页面动画</span>
            <Segmented value={sys.animation} options={ANIM_OPTIONS} onChange={(v) => setSysPref('animation', v)} />
          </div>
        </section>

        <section className="card settings-group">
          <GroupTitle>阅读区设置 · 仅阅读</GroupTitle>
          <div className="settings-row">
            <span className="settings-row-label">阅读字号</span>
            <Segmented
              value={String(READ_FONT_BUCKETS[readFontBucketIndex(read.fontSize)].value)}
              options={READ_FONT_OPTIONS}
              onChange={(v) => setReadPref('fontSize', Number(v))}
            />
          </div>
          <div className="settings-row">
            <span className="settings-row-label">阅读字体</span>
            <Segmented value={read.fontFamily} options={FAMILY_OPTIONS} onChange={(v) => setReadPref('fontFamily', v)} />
          </div>
          <div className="settings-row">
            <span className="settings-row-label">阅读背景</span>
            <ColorSwatches value={read.bgColor} options={READ_BG_OPTIONS} onChange={(v) => setReadPref('bgColor', v)} />
          </div>
          <div className="settings-row">
            <span className="settings-row-label">翻页动画</span>
            <Segmented value={read.animation} options={ANIM_OPTIONS} onChange={(v) => setReadPref('animation', v)} />
          </div>
          <p className="settings-hint">行距与亮度可在阅读页右上「设置」浮层里调整。</p>
        </section>

        <section className="card settings-group danger-zone" data-danger="true">
          <GroupTitle>数据管理</GroupTitle>
          <p className="settings-hint danger-hint">以下操作会删除本地记录，且不可恢复。</p>
          <div className="row-actions">
            <button type="button" className="btn btn-ghost btn-danger" onClick={onClearHistory}>
              清空阅读历史
            </button>
            <button type="button" className="btn btn-ghost btn-danger" onClick={onClearLastRead}>
              清除续读位置
            </button>
          </div>
        </section>
      </div>

      {toast ? <div className="toast">{toast}</div> : null}

      <p className="settings-version">v{APP_VERSION} · 内容由 @pks/core 校验</p>

      <ConfirmDialog
        visible={confirmKind !== null}
        danger={confirmKind === 'history'}
        title={confirmKind === 'history' ? '清空阅读历史' : '清除续读位置'}
        message={
          confirmKind === 'history'
            ? '将删除全部阅读历史记录，此操作不可恢复。'
            : '清除后将取消首页续读卡片，下次打开回到首页。'
        }
        confirmText="确认"
        cancelText="取消"
        onConfirm={runClear}
        onCancel={closeConfirm}
      />
    </div>
  );
}
