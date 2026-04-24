import { describe, it, expect } from 'vitest';
import { DEFAULT_TIMECODE_OVERLAY } from '../store/timeline/types';

describe('DEFAULT_TIMECODE_OVERLAY', () => {
  it('startDateTime が 0 である（モジュール読み込み時の Date.now() に依存しない）', () => {
    expect(DEFAULT_TIMECODE_OVERLAY.startDateTime).toBe(0);
  });

  it('enabled が false である', () => {
    expect(DEFAULT_TIMECODE_OVERLAY.enabled).toBe(false);
  });

  it('デフォルト値が参照透過である（何度読んでも同じ値）', () => {
    const a = { ...DEFAULT_TIMECODE_OVERLAY };
    const b = { ...DEFAULT_TIMECODE_OVERLAY };
    expect(a).toEqual(b);
  });
});
