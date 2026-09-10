import { describe, it, expect } from 'vitest';
import { slugifyHeading } from '../src/parse/slugify.js';

describe('slugifyHeading', () => {
  it('keeps CJK characters and joins words with hyphens', () => {
    expect(slugifyHeading('第一章 概述')).toBe('第一章-概述');
  });

  it('lowercases latin text', () => {
    expect(slugifyHeading('Hello World')).toBe('hello-world');
  });

  it('collapses runs of whitespace and hyphens', () => {
    expect(slugifyHeading('a   b')).toBe('a-b');
    expect(slugifyHeading('a---b')).toBe('a-b');
  });

  it('strips leading and trailing hyphens', () => {
    expect(slugifyHeading('  -x-  ')).toBe('x');
  });

  it('removes punctuation while keeping letters and numbers', () => {
    expect(slugifyHeading('《资本论》')).toBe('资本论');
    expect(slugifyHeading('Node.js')).toBe('nodejs');
    expect(slugifyHeading('C++ 与 Rust')).toBe('c-与-rust');
  });

  it('returns an empty string for blank input', () => {
    expect(slugifyHeading('')).toBe('');
    expect(slugifyHeading('   ')).toBe('');
    expect(slugifyHeading('！！！')).toBe('');
  });
});
