import { describe, expect, it } from 'vitest';
import { calculateContainedRect } from '../utils/videoDisplayRect';

describe('calculateContainedRect', () => {
  it('fits landscape media with vertical letterboxing', () => {
    const rect = calculateContainedRect(
      { width: 1200, height: 1000 },
      { width: 1920, height: 1080 },
    );

    expect(rect.left).toBe(0);
    expect(rect.width).toBe(1200);
    expect(rect.height).toBeCloseTo(675);
    expect(rect.top).toBeCloseTo(162.5);
  });

  it('fits portrait media with horizontal pillarboxing', () => {
    const rect = calculateContainedRect(
      { width: 1200, height: 800 },
      { width: 1080, height: 1920 },
    );

    expect(rect.top).toBe(0);
    expect(rect.height).toBe(800);
    expect(rect.width).toBeCloseTo(450);
    expect(rect.left).toBeCloseTo(375);
  });

  it('returns the full container when aspect ratios match', () => {
    const rect = calculateContainedRect(
      { width: 1280, height: 720 },
      { width: 1920, height: 1080 },
    );

    expect(rect).toEqual({ left: 0, top: 0, width: 1280, height: 720 });
  });
});
