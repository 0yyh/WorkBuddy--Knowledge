import { describe, it, expect } from 'vitest';
import { extractWikiLinks, resolveWikiLinks } from '../src/parse/wikilink.js';

describe('extractWikiLinks', () => {
  it('extracts [[Target]] and [[Target|label]]', () => {
    const links = extractWikiLinks('See [[Target]] and [[Target|label]] here.');
    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({ target: 'Target', label: undefined });
    expect(links[1]).toMatchObject({ target: 'Target', label: 'label' });
  });

  it('splits a section target into target + section', () => {
    const links = extractWikiLinks('Read [[foo/bar]] and [[foo/baz|Weird]].');
    expect(links[0]).toMatchObject({ target: 'foo', section: 'bar' });
    expect(links[1]).toMatchObject({ target: 'foo', section: 'baz', label: 'Weird' });
  });

  it('extracts entry:// markdown style links', () => {
    const links = extractWikiLinks('A [text](entry://slug/key) reference.');
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ target: 'slug', section: 'key', label: 'text' });
  });
});

describe('resolveWikiLinks', () => {
  it('marks links resolved when the target is in the known slug set', () => {
    const known = new Set(['foo']);
    const refs = resolveWikiLinks('[[foo]] and [[bar]].', known);
    expect(refs).toHaveLength(2);
    expect(refs[0].resolved).toBe(true);
    expect(refs[1].resolved).toBe(false);
    expect(refs[0].target).toBe('foo');
  });
});
