import { describe, it, expect } from 'vitest';
import { computeIndicatorLayout } from '@/components/Timeline/transitionLayout';

const transition = {
  id: 'transition-clip-1-clip-2',
  type: 'crossfade' as const,
  duration: 1.0,
  outTrackId: 'video-1',
  outClipId: 'clip-1',
  inTrackId: 'video-1',
  inClipId: 'clip-2',
};

describe('computeIndicatorLayout', () => {
  it('トランジション幅を duration * pixelsPerSecond で計算する', () => {
    const { width } = computeIndicatorLayout(transition, 50, { startTime: 5 });
    expect(width).toBe(50);
  });

  it('left 位置を clipStartTime * pixelsPerSecond - width / 2 で計算する', () => {
    // clipStartTime=5, pixelsPerSecond=50, duration=1.0
    // width = 1.0 * 50 = 50, left = 5 * 50 - 50/2 = 250 - 25 = 225
    const { left } = computeIndicatorLayout(transition, 50, { startTime: 5 });
    expect(left).toBe(225);
  });

  it('duration が大きいほど幅が広くなる', () => {
    const { width: w1 } = computeIndicatorLayout({ ...transition, duration: 0.5 }, 100, { startTime: 0 });
    const { width: w2 } = computeIndicatorLayout({ ...transition, duration: 2.0 }, 100, { startTime: 0 });
    expect(w2).toBeGreaterThan(w1);
  });

  it('pixelsPerSecond が大きいほど幅が広くなる', () => {
    const { width: w1 } = computeIndicatorLayout(transition, 50, { startTime: 0 });
    const { width: w2 } = computeIndicatorLayout(transition, 200, { startTime: 0 });
    expect(w2).toBeGreaterThan(w1);
  });

  it('clipStartTime=0 の場合、left は負の値になる（インジケータが中央配置）', () => {
    const { left } = computeIndicatorLayout(transition, 50, { startTime: 0 });
    // left = 0 * 50 - 50/2 = -25
    expect(left).toBe(-25);
  });

  it('duration=0 の場合、幅は0でleftはクリップ開始位置', () => {
    const { width, left } = computeIndicatorLayout({ ...transition, duration: 0 }, 50, { startTime: 10 });
    expect(width).toBe(0);
    expect(left).toBe(500); // 10 * 50 - 0/2
  });

  it('具体的な計算例: duration=2.0, pps=100, start=3.0', () => {
    // width = 2.0 * 100 = 200, left = 3.0 * 100 - 200/2 = 300 - 100 = 200
    const { width, left } = computeIndicatorLayout({ ...transition, duration: 2.0 }, 100, { startTime: 3.0 });
    expect(width).toBe(200);
    expect(left).toBe(200);
  });
});
