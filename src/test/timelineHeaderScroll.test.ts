import { describe, it, expect } from 'vitest';
import { normalizeWheelDelta } from '@/utils/wheelDelta';

describe('normalizeWheelDelta', () => {
  it('DOM_DELTA_PIXEL (mode=0) はそのまま返す', () => {
    expect(normalizeWheelDelta(100, 0, 500)).toBe(100);
  });

  it('DOM_DELTA_LINE (mode=1) は 16px 換算する', () => {
    expect(normalizeWheelDelta(3, 1, 500)).toBe(48);
  });

  it('DOM_DELTA_PAGE (mode=2) は viewport 高さを掛ける', () => {
    expect(normalizeWheelDelta(1, 2, 600)).toBe(600);
  });

  it('負の delta（上方向スクロール）も正しく正規化する', () => {
    expect(normalizeWheelDelta(-2, 1, 500)).toBe(-32);
  });
});
