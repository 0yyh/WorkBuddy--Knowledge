/**
 * 搜索框：输入即时 L1（title/aliases，零分片加载），回车/按钮触发 L2 全文（惰性拉分片）。
 */
import { useCallback, useRef, useState } from 'react';
import type { SearchHit } from '@pks/core';
import { navigate } from '../router';
import { useStation } from '../state/AppContext';

interface SearchBoxProps {
  size?: 'compact' | 'large';
  initialQuery?: string;
}

const SUGGEST_LIMIT = 8;

export function SearchBox({ size = 'compact', initialQuery = '' }: SearchBoxProps): JSX.Element {
  const { engine } = useStation();
  const [query, setQuery] = useState<string>(initialQuery);
  const [suggestions, setSuggestions] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState<boolean>(false);
  const blurTimer = useRef<number | null>(null);

  const runSuggest = useCallback(
    (value: string) => {
      const q = value.trim();
      if (!q || !engine) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      const hits = engine.searchL1(q).slice(0, SUGGEST_LIMIT);
      setSuggestions(hits);
      setOpen(hits.length > 0);
    },
    [engine],
  );

  const goFull = useCallback(() => {
    const q = query.trim();
    if (!q) return;
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(q)}&full=1`);
  }, [query]);

  const clearQuery = useCallback(() => {
    setQuery('');
    setSuggestions([]);
    setOpen(false);
  }, []);

  const openEntry = useCallback((slug: string) => {
    setOpen(false);
    navigate(`/entry/${encodeURIComponent(slug)}`);
  }, []);

  return (
    <div className={`search-box search-${size}`}>
      <div className="search-input-wrap">
        <span className="search-icon" aria-hidden="true">
          ⌕
        </span>
        <input
          className="search-input"
          type="search"
          value={query}
          placeholder={size === 'large' ? '搜索全文检索' : '搜索词条'}
          aria-label="搜索"
          onChange={(e) => {
            setQuery(e.target.value);
            runSuggest(e.target.value);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          onBlur={() => {
            if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
            blurTimer.current = window.setTimeout(() => setOpen(false), 160);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              goFull();
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
        {query ? (
          <button
            type="button"
            className="search-clear"
            aria-label="清空搜索"
            onClick={clearQuery}
          >
            ×
          </button>
        ) : null}
        {size === 'large' ? (
          <button
            type="button"
            className="search-submit"
            onClick={goFull}
            aria-label="全文检索"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
              <line x1="15.5" y1="15.5" x2="20" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>

      {open && suggestions.length > 0 ? (
        <div className="suggest" role="listbox">
          {suggestions.map((hit) => {
            const isSection = hit.doc.kind === 'section';
            return (
              <button
                type="button"
                key={hit.doc.id}
                className="suggest-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => openEntry(isSection ? hit.doc.entrySlug ?? hit.doc.slug : hit.doc.slug)}
              >
                <span className="suggest-title">{hit.doc.title}</span>
                <span className="suggest-kind">{isSection ? '章节' : '词条'}</span>
              </button>
            );
          })}
          <button
            type="button"
            className="suggest-more"
            onMouseDown={(e) => e.preventDefault()}
            onClick={goFull}
          >
            全文检索「{query.trim()}」
          </button>
        </div>
      ) : null}
    </div>
  );
}
