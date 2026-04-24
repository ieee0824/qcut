import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildId, generateId } from '../utils/idGenerator';

describe('generateId', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('指定したprefixで始まるIDを生成する', () => {
    const id = buildId('clip', { timestamp: 123, randomValue: 0.25 });
    expect(id.startsWith('clip-')).toBe(true);
  });

  it('外部入力を固定すれば決定的なIDを生成する', () => {
    const id = buildId('test', { timestamp: 1000000, randomValue: 0.123456789 });
    expect(id).toBe('test-1000000-4fzzzx');
  });

  it('同じ入力で同じIDを返す（参照透過性）', () => {
    const entropy = { timestamp: 9999, randomValue: 0.5 };
    const id1 = buildId('clip', entropy);
    const id2 = buildId('clip', entropy);
    expect(id1).toBe(id2);
  });

  it('異なるprefixで異なるIDを返す', () => {
    const entropy = { timestamp: 1000, randomValue: 0.1 };
    const id1 = buildId('clip', entropy);
    const id2 = buildId('track', entropy);
    expect(id1).not.toBe(id2);
    expect(id1.startsWith('clip-')).toBe(true);
    expect(id2.startsWith('track-')).toBe(true);
  });

  it('generateId は既定で現在時刻と乱数を使う', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000000);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);

    const id = generateId('test');
    expect(id).toBe('test-1000000-4fzzzx');
  });
});
