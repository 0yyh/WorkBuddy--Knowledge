import { describe, it, expect } from 'vitest';
import { validateEntryMeta, validateSectionMeta } from '../src/parse/frontmatter.js';

describe('validateEntryMeta', () => {
  it('accepts a valid entry without errors', () => {
    const { errors } = validateEntryMeta({
      slug: 'foo',
      title: 'Foo',
      type: 'concept',
      categories: ['Philosophy'],
      summary: 'This is a sufficiently long summary that comfortably exceeds the eighty character minimum requirement for validation to pass cleanly here.',
      status: 'published',
      sources: [{ title: 'Source One', url: 'https://example.com' }],
    });
    expect(errors).toEqual([]);
  });

  it('reports an error for an invalid type', () => {
    const { errors } = validateEntryMeta({
      slug: 'foo',
      title: 'Foo',
      type: 'not-a-type',
      categories: ['Philosophy'],
      summary: 'This is a sufficiently long summary that comfortably exceeds the eighty character minimum requirement for validation to pass cleanly here.',
      status: 'published',
      sources: [{ title: 'Source One' }],
    });
    expect(errors.some((e) => e.includes('type'))).toBe(true);
  });

  it('warns (does not error) for a too-short summary', () => {
    const { errors, warnings } = validateEntryMeta({
      slug: 'foo',
      title: 'Foo',
      type: 'concept',
      categories: ['Philosophy'],
      summary: 'too short',
      status: 'published',
      sources: [{ title: 'Source One' }],
    });
    expect(errors.some((e) => e.includes('summary 超长'))).toBe(false);
    expect(warnings.some((w) => w.includes('summary 偏短'))).toBe(true);
  });
});

describe('validateSectionMeta', () => {
  const base = {
    slug: 'foo/c1',
    work: 'foo',
    key: 'c1',
    title: 'Chapter One',
    order: [1],
    depth: 1,
    kind: 'content',
    summary: { tldr: 'A short tldr summary that is well within the one hundred twenty character limit for chapter summaries.' },
  };

  it('accepts a valid section without errors', () => {
    const { errors } = validateSectionMeta({ ...base });
    expect(errors).toEqual([]);
  });

  it('errors on an invalid order array', () => {
    const { errors } = validateSectionMeta({ ...base, order: [1, 2, 3, 4] });
    expect(errors.some((e) => e.includes('order'))).toBe(true);
  });

  it('errors on an unknown kind', () => {
    const { errors } = validateSectionMeta({ ...base, kind: 'mystery' });
    expect(errors.some((e) => e.includes('kind'))).toBe(true);
  });

  it('errors when summary.tldr is missing on a content section', () => {
    const { errors } = validateSectionMeta({ ...base, summary: {} });
    expect(errors.some((e) => e.includes('tldr'))).toBe(true);
  });
});
