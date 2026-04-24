import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateId } from '../utils/idGenerator';

describe('generateId', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('指定したprefixで始まるIDを生成する', () => {
    const id = generateId('clip');
    expect(id.startsWith('clip-')).toBe(true);
  });

  it('Date.now と Math.random を使って決定的なIDを生成する', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000000);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);

    const id = generateId('test');
    expect(id).toBe('test-1000000-4fzzzx');
  });

  it('同じ入力で同じIDを返す（参照透過性）', () => {
    vi.spyOn(Date, 'now').mockReturnValue(9999);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const id1 = generateId('clip');
    const id2 = generateId('clip');
    expect(id1).toBe(id2);
  });

  it('異なるprefixで異なるIDを返す', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    vi.spyOn(Math, 'random').mockReturnValue(0.1);

    const id1 = generateId('clip');
    const id2 = generateId('track');
    expect(id1).not.toBe(id2);
    expect(id1.startsWith('clip-')).toBe(true);
    expect(id2.startsWith('track-')).toBe(true);
  });
});
