/**
 * 学习序列页 #/timeline/:trackId：
 *  - 无 id 时列出全部可用序列
 *  - 有 id 时按 Track.items 顺序渲染；跨轨条目展示「双轨」徽标
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Track } from '@pks/core';
import { TimelineView } from '../components/TimelineView';
import { Spinner } from '../components/Spinner';
import { Link } from '../router';
import { fetchTrackSummaries } from '../lib/content';
import { useStation } from '../state/AppContext';
import type { TimelineRow, TrackSummary } from '../types';

interface TimelinePageProps {
  trackId: string;
}

export function TimelinePage({ trackId }: TimelinePageProps): JSX.Element {
  const { slugMap, getTrack } = useStation();
  const [track, setTrack] = useState<Track | null>(null);
  const [allTracks, setAllTracks] = useState<Array<{ summary: TrackSummary; track: Track }>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const summaries = await fetchTrackSummaries();
    const loaded = await Promise.all(
      summaries.map(async (summary) => {
        try {
          return { summary, track: await getTrack(summary.id) };
        } catch {
          return null;
        }
      }),
    );
    return loaded.filter((x): x is { summary: TrackSummary; track: Track } => x !== null);
  }, [getTrack]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setTrack(null);

    const task = trackId
      ? getTrack(trackId).then((t) => {
          if (!alive) return;
          setTrack(t);
        })
      : loadAll().then((list) => {
          if (!alive) return;
          setAllTracks(list);
        });

    task
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [trackId, getTrack, loadAll]);

  const rows: TimelineRow[] = useMemo(() => {
    if (!track) return [];
    return track.items.map((it) => {
      const item = slugMap.get(it.entry);
      return {
        item: it,
        title: item?.t ?? it.entry,
        summary: item?.sm ?? '',
        exists: Boolean(item),
        cross: it.cross_timeline === true || item?.ctl === 1 || (item?.tl?.length ?? 0) > 1,
      };
    });
  }, [track, slugMap]);

  if (loading) {
    return (
      <div className="page state-box">
        <Spinner />
        <p className="state-title">正在装载学习序列…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page state-box">
        <div className="error-card">
          <h2>序列加载失败</h2>
          <p className="error-msg">{error}</p>
          <Link to="/" className="btn btn-primary">
            回到首页
          </Link>
        </div>
      </div>
    );
  }

  if (!trackId) {
    return (
      <div className="page">
        <h1 className="page-title">学习序列</h1>
        <p className="page-sub">按时间 / 难度 / 依赖组织的顺序阅读路径</p>
        {allTracks.length === 0 ? (
          <p className="empty">未找到任何序列（请确认 content/tracks 已同步）</p>
        ) : (
          <ul className="card-list card-list-2">
            {allTracks.map(({ summary, track: t }) => (
              <li key={summary.id} className="card card-hover">
                <Link to={`/timeline/${encodeURIComponent(t.id)}`} className="track-card-link">
                  <span className="card-title link-strong">{t.title}</span>
                  <p className="clamp-2">{t.description ?? ''}</p>
                  <div className="meta-row meta-row-sm">
                    <span className="dim">{t.items.length} 个节点</span>
                    <span className="dim">{t.order_mode}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <TimelineView
        rows={rows}
        title={track?.title ?? trackId}
        description={track?.description}
        timeline={track?.timeline}
      />
    </div>
  );
}
