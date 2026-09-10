/**
 * 「我的」页（底部第四 Tab）：聚合 设置 / 看过 / 内容更新 / 关于。
 * 设置不再占独立底部 Tab（避免阅读 App 反模式），从这里进入。
 *
 * 本页复用既有样式类（.card / .me-row / .search-input / .btn …），不新增 CSS。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from '../router';
import { useStation } from '../state/AppContext';
import {
  applyContentUpdate,
  checkForContentUpdate,
  getCurrentContentBuiltAt,
  getUpdateSourceUrl,
  importLocalFiles,
  resetContentCache,
  setUpdateSourceUrl,
} from '../lib/contentUpdater';
import type { UpdateManifest } from '../lib/contentUpdater';

const ITEMS: Array<{ to: string; icon: string; label: string; desc: string }> = [
  { to: '/settings', icon: '⚙', label: '设置', desc: '全局字号 / 字体 / 背景 / 阅读区偏好' },
  { to: '/history', icon: '◷', label: '阅读历史', desc: '查看与清空看过的词条' },
];

/** ISO 时间 → 本地可读短串（格式化失败则返回原文，不抛错） */
function formatBuiltAt(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MePage(): JSX.Element {
  const { manifest } = useStation();
  const built = manifest?.built_at.slice(0, 10) ?? '—';
  const stats = manifest?.stats;

  const [url, setUrl] = useState<string>(() => getUpdateSourceUrl());
  const [busy, setBusy] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('');
  const [pending, setPending] = useState<UpdateManifest | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [localBuilt, setLocalBuilt] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let alive = true;
    getCurrentContentBuiltAt()
      .then((v) => {
        if (alive) setLocalBuilt(v);
      })
      .catch(() => {
        /* 读不到版本不影响页面 */
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleUrlChange = useCallback((value: string) => {
    setUrl(value);
    setUpdateSourceUrl(value);
  }, []);

  const handleCheck = useCallback(async () => {
    const target = url.trim();
    if (!target) {
      setStatus('请先填写更新源地址，例如 http://192.168.1.10:8080/');
      return;
    }
    setBusy(true);
    setStatus('正在检查…');
    setProgress(null);
    try {
      const result = await checkForContentUpdate(target);
      if (!result.manifest) {
        setPending(null);
        setStatus(`检查失败：${result.reason ?? '未知原因'}`);
        return;
      }
      if (result.hasUpdate) {
        setPending(result.manifest);
        setStatus(
          `发现新版本（${formatBuiltAt(result.manifest.built_at)}）· ${result.manifest.files.length} 个文件`,
        );
      } else {
        setPending(null);
        setStatus(`已是最新（${formatBuiltAt(result.manifest.built_at)}）`);
      }
    } catch (e) {
      setPending(null);
      setStatus(`检查失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }, [url]);

  const handleApply = useCallback(async () => {
    if (!pending) {
      setStatus('请先点「检查更新」，确认有新版本后再更新');
      return;
    }
    const target = url.trim();
    setBusy(true);
    setProgress({ done: 0, total: pending.files.length });
    setStatus('正在下载…');
    try {
      const result = await applyContentUpdate(target, pending, (done, total) => {
        setProgress({ done, total });
      });
      const warn = result.warnings.length > 0 ? `（${result.warnings.join('；')}）` : '';
      if (result.activated) {
        setStatus(`更新完成：已更新 ${result.updated} 个文件${warn}。请点「重新加载」生效。`);
      } else {
        setStatus(
          `更新未完成：成功 ${result.updated} 个、失败 ${result.failed} 个${warn}。请检查网络后重试（内容保持原样）。`,
        );
      }
      setLocalBuilt(await getCurrentContentBuiltAt());
    } catch (e) {
      setStatus(`更新失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }, [pending, url]);

  const handleReload = useCallback(() => {
    if (typeof window !== 'undefined' && window.location) {
      window.location.reload();
    }
  }, []);

  const handleReset = useCallback(async () => {
    setBusy(true);
    setStatus('正在清除本机内容缓存…');
    try {
      await resetContentCache();
      setPending(null);
      setLocalBuilt(await getCurrentContentBuiltAt());
      setStatus('已清除本机内容缓存，点「重新加载」回到随包内容。');
    } finally {
      setBusy(false);
    }
  }, []);

  const handleImportPick = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setStatus(`正在导入 ${files.length} 个文件…`);
    try {
      const list = Array.from(files);
      const result = await importLocalFiles(list);
      setStatus(
        `导入完成：${result.imported} 个文件已写入本机内容层${result.skipped > 0 ? `，跳过 ${result.skipped} 个（需位于 entries/ index/ tracks/ dict/ 下）` : ''}。请点「重新加载」生效。`,
      );
    } catch (e) {
      setStatus(`导入失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className="page me-page">
      <h1 className="page-title">我的</h1>

      <section className="card me-profile">
        <span className="me-avatar" aria-hidden="true">
          知
        </span>
        <div className="me-profile-text">
          <strong className="me-name">本地知识库</strong>
          <span className="me-sub">离线 · 私有 · 顺序阅读</span>
        </div>
      </section>

      <section className="card me-list">
        {ITEMS.map((it) => (
          <Link key={it.to} to={it.to} className="me-row">
            <span className="me-row-icon" aria-hidden="true">
              {it.icon}
            </span>
            <span className="me-row-main">
              <span className="me-row-label">{it.label}</span>
              <span className="me-row-desc">{it.desc}</span>
            </span>
            <span className="me-row-arrow" aria-hidden="true">
              ›
            </span>
          </Link>
        ))}

        {/* 导入内容包：用 label 包住隐藏 input，点击即唤起文件选择，无需新样式。
            存在必要性：局域网更新需要「电脑跑 serve-lan 做服务端」，本机导入是其离线互补——
            没有电脑/局域网时（如把内容包经 USB、微信、云盘传到手机），可直接选文件写入本机内容层。 */}
        <label className="me-row" htmlFor="pks-import-files" style={{ cursor: 'pointer' }}>
          <span className="me-row-icon" aria-hidden="true">
            📥
          </span>
          <span className="me-row-main">
            <span className="me-row-label">导入内容包</span>
            <span className="me-row-desc">
              本机离线导入（无需电脑/局域网）：把内容包经 USB、微信、云盘传到手机后直接选文件导入
            </span>
          </span>
          <span className="me-row-arrow" aria-hidden="true">
            ›
          </span>
        </label>
        <input
          ref={fileInputRef}
          id="pks-import-files"
          type="file"
          multiple
          accept=".json,.md,.markdown,.yaml,.yml,.txt"
          style={{ display: 'none' }}
          onChange={(e) => {
            void handleImportPick(e.target.files);
          }}
        />
      </section>

      <section className="card" style={{ marginTop: 16, padding: 14 }}>
        <h3 className="card-label">内容更新</h3>
        <p className="me-about-note">
          在电脑上跑 <code>node scripts/serve-lan.mjs release/latest 8080</code>，手机连同一
          局域网后填入地址，即可不重装应用更新词条与索引。
        </p>

        <div className="search-input-wrap" style={{ marginTop: 10 }}>
          <span className="search-icon" aria-hidden="true">
            🔗
          </span>
          <input
            className="search-input"
            type="text"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="http://192.168.1.10:8080/"
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
          />
        </div>

        <div className="row-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void handleCheck()}>
            检查更新
          </button>
          <button type="button" className="btn" disabled={busy || !pending} onClick={() => void handleApply()}>
            立即更新
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={handleReload}>
            重新加载
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void handleReset()}>
            清除缓存
          </button>
        </div>

        {progress ? (
          <p className="me-about-note">
            正在更新 {progress.done}/{progress.total} 个文件…
          </p>
        ) : null}
        {status ? <p className="me-about-note">{status}</p> : null}
        <p className="me-about-note">本机内容版本：{formatBuiltAt(localBuilt)}</p>
      </section>

      <section className="card me-about">
        <h3 className="card-label">关于</h3>
        <ul className="me-about-list">
          <li>
            <span>内容</span>
            <span>
              {stats ? `${stats.entries} 词条 · ${stats.sections} 章 · ${stats.words} 字` : '加载中'}
            </span>
          </li>
          <li>
            <span>索引构建</span>
            <span>{built}</span>
          </li>
          <li>
            <span>版本</span>
            <span>
              v0.1.0
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => void handleCheck()}
                style={{ marginLeft: 8, padding: '4px 10px', fontSize: '0.75rem' }}
              >
                检查更新
              </button>
            </span>
          </li>
        </ul>
        <p className="me-about-note">内容由 @pks/core 校验并净化后渲染，全部数据保存在本机。</p>
      </section>
    </div>
  );
}
