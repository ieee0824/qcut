import { describe, it, expect } from 'vitest';
import {
  RESOLUTION_OPTIONS,
  FPS_OPTIONS,
  BITRATE_OPTIONS,
  FORMAT_OPTIONS,
  formatEstimatedRemaining,
  findResolutionIndex,
} from '@/hooks/useExportDialog';

const LABELS = {
  remaining: '残り',
  seconds: '秒',
  minutes: '分',
  hours: '時間',
};

describe('useExportDialog 定数', () => {
  describe('RESOLUTION_OPTIONS', () => {
    it('Full HD, HD, SD の3つの解像度を持つ', () => {
      expect(RESOLUTION_OPTIONS).toHaveLength(3);
    });

    it('各解像度にlabel, width, heightが定義されている', () => {
      for (const opt of RESOLUTION_OPTIONS) {
        expect(opt).toHaveProperty('label');
        expect(opt).toHaveProperty('width');
        expect(opt).toHaveProperty('height');
        expect(opt.width).toBeGreaterThan(0);
        expect(opt.height).toBeGreaterThan(0);
      }
    });

    it('Full HD (1920x1080) が含まれる', () => {
      const fhd = RESOLUTION_OPTIONS.find((o) => o.width === 1920 && o.height === 1080);
      expect(fhd).toBeDefined();
    });
  });

  describe('FPS_OPTIONS', () => {
    it('24, 30, 60 fpsを持つ', () => {
      expect(FPS_OPTIONS).toEqual([24, 30, 60]);
    });
  });

  describe('BITRATE_OPTIONS', () => {
    it('4つのビットレート選択肢を持つ', () => {
      expect(BITRATE_OPTIONS).toHaveLength(4);
    });

    it('各選択肢にlabelとvalueが定義されている', () => {
      for (const opt of BITRATE_OPTIONS) {
        expect(opt).toHaveProperty('label');
        expect(opt).toHaveProperty('value');
        expect(opt.value).toMatch(/^\d+M$/);
      }
    });
  });

  describe('FORMAT_OPTIONS', () => {
    it('mp4, mov, avi, webm の4つのフォーマットを持つ', () => {
      const values = FORMAT_OPTIONS.map((f) => f.value);
      expect(values).toEqual(['mp4', 'mov', 'avi', 'webm']);
    });

    it('各フォーマットにlabel, value, ext, filterNameが定義されている', () => {
      for (const opt of FORMAT_OPTIONS) {
        expect(opt).toHaveProperty('label');
        expect(opt).toHaveProperty('value');
        expect(opt).toHaveProperty('ext');
        expect(opt).toHaveProperty('filterName');
      }
    });
  });
});

describe('formatEstimatedRemaining', () => {
  it('progress が 0 以下の場合 null を返す', () => {
    expect(formatEstimatedRemaining(10, 0, LABELS)).toBeNull();
    expect(formatEstimatedRemaining(10, -1, LABELS)).toBeNull();
  });

  it('経過時間が2秒未満の場合 null を返す（データ不足）', () => {
    expect(formatEstimatedRemaining(1.5, 0.5, LABELS)).toBeNull();
    expect(formatEstimatedRemaining(0, 0.1, LABELS)).toBeNull();
  });

  it('残り時間が60秒未満の場合、秒単位で表示する', () => {
    // elapsed=10s, progress=0.5 → remaining = 10 * (1-0.5)/0.5 = 10s
    const result = formatEstimatedRemaining(10, 0.5, LABELS);
    expect(result).toBe('残り: 10秒');
  });

  it('残り時間が60秒以上3600秒未満の場合、分単位で表示する', () => {
    // elapsed=10s, progress=0.1 → remaining = 10 * 0.9/0.1 = 90s → 2分
    const result = formatEstimatedRemaining(10, 0.1, LABELS);
    expect(result).toBe('残り: 2分');
  });

  it('残り時間が3600秒以上の場合、時間+分で表示する', () => {
    // elapsed=100s, progress=0.01 → remaining = 100 * 0.99/0.01 = 9900s → 2時間45分
    const result = formatEstimatedRemaining(100, 0.01, LABELS);
    expect(result).toBe('残り: 2時間45分');
  });

  it('進捗がほぼ完了の場合、残り時間が短くなる', () => {
    // elapsed=50s, progress=0.99 → remaining = 50 * 0.01/0.99 ≈ 0.505s → 1秒
    const result = formatEstimatedRemaining(50, 0.99, LABELS);
    expect(result).toBe('残り: 1秒');
  });
});

describe('findResolutionIndex', () => {
  it('Full HD (1920x1080) のインデックスを返す', () => {
    expect(findResolutionIndex(1920, 1080)).toBe(0);
  });

  it('HD (1280x720) のインデックスを返す', () => {
    expect(findResolutionIndex(1280, 720)).toBe(1);
  });

  it('SD (854x480) のインデックスを返す', () => {
    expect(findResolutionIndex(854, 480)).toBe(2);
  });

  it('一致しない解像度の場合 -1 を返す', () => {
    expect(findResolutionIndex(3840, 2160)).toBe(-1);
  });
});
