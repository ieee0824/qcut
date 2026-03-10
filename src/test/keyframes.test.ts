import { describe, it, expect } from 'vitest';
import { interpolateKeyframes, getEffectsAtTime, hasActiveKeyframes } from '../utils/keyframes';
import { DEFAULT_EFFECTS } from '../store/timelineStore';
import type { Keyframe, Clip } from '../store/timelineStore';

const makeClip = (overrides: Partial<Clip> = {}): Clip => ({
  id: 'test-clip',
  name: 'test',
  startTime: 0,
  duration: 10,
  filePath: '/test.mp4',
  sourceStartTime: 0,
  sourceEndTime: 10,
  ...overrides,
});

describe('interpolateKeyframes', () => {
  it('should return null for empty keyframes', () => {
    expect(interpolateKeyframes([], 1.0)).toBeNull();
  });

  it('should return the single keyframe value regardless of time', () => {
    const kfs: Keyframe[] = [{ time: 2.0, value: 0.5, easing: 'linear' }];
    expect(interpolateKeyframes(kfs, 0.0)).toBe(0.5);
    expect(interpolateKeyframes(kfs, 2.0)).toBe(0.5);
    expect(interpolateKeyframes(kfs, 5.0)).toBe(0.5);
  });

  it('should return first value when time is before first keyframe', () => {
    const kfs: Keyframe[] = [
      { time: 2.0, value: 0.0, easing: 'linear' },
      { time: 4.0, value: 1.0, easing: 'linear' },
    ];
    expect(interpolateKeyframes(kfs, 0.0)).toBe(0.0);
    expect(interpolateKeyframes(kfs, 1.0)).toBe(0.0);
  });

  it('should return last value when time is after last keyframe', () => {
    const kfs: Keyframe[] = [
      { time: 2.0, value: 0.0, easing: 'linear' },
      { time: 4.0, value: 1.0, easing: 'linear' },
    ];
    expect(interpolateKeyframes(kfs, 5.0)).toBe(1.0);
    expect(interpolateKeyframes(kfs, 10.0)).toBe(1.0);
  });

  it('should linearly interpolate between two keyframes', () => {
    const kfs: Keyframe[] = [
      { time: 0.0, value: 0.0, easing: 'linear' },
      { time: 4.0, value: 1.0, easing: 'linear' },
    ];
    expect(interpolateKeyframes(kfs, 2.0)).toBeCloseTo(0.5);
    expect(interpolateKeyframes(kfs, 1.0)).toBeCloseTo(0.25);
    expect(interpolateKeyframes(kfs, 3.0)).toBeCloseTo(0.75);
  });

  it('should apply easeIn easing', () => {
    const kfs: Keyframe[] = [
      { time: 0.0, value: 0.0, easing: 'easeIn' },
      { time: 4.0, value: 1.0, easing: 'linear' },
    ];
    const midLinear = 0.5;
    const midEaseIn = interpolateKeyframes(kfs, 2.0) as number;
    // easeIn is slower at start, so at t=0.5 the value should be less than linear
    expect(midEaseIn).toBeLessThan(midLinear);
    expect(midEaseIn).toBeCloseTo(0.25); // t*t at t=0.5
  });

  it('should apply easeOut easing', () => {
    const kfs: Keyframe[] = [
      { time: 0.0, value: 0.0, easing: 'easeOut' },
      { time: 4.0, value: 1.0, easing: 'linear' },
    ];
    const midLinear = 0.5;
    const midEaseOut = interpolateKeyframes(kfs, 2.0) as number;
    // easeOut is faster at start, so at t=0.5 the value should be more than linear
    expect(midEaseOut).toBeGreaterThan(midLinear);
    expect(midEaseOut).toBeCloseTo(0.75); // t*(2-t) at t=0.5
  });

  it('should apply easeInOut easing', () => {
    const kfs: Keyframe[] = [
      { time: 0.0, value: 0.0, easing: 'easeInOut' },
      { time: 4.0, value: 1.0, easing: 'linear' },
    ];
    const midEaseInOut = interpolateKeyframes(kfs, 2.0) as number;
    expect(midEaseInOut).toBeCloseTo(0.5); // symmetric at midpoint
  });

  it('should interpolate correctly with 3 keyframes', () => {
    const kfs: Keyframe[] = [
      { time: 0.0, value: 0.0, easing: 'linear' },
      { time: 2.0, value: 1.0, easing: 'linear' },
      { time: 4.0, value: 0.0, easing: 'linear' },
    ];
    expect(interpolateKeyframes(kfs, 1.0)).toBeCloseTo(0.5);
    expect(interpolateKeyframes(kfs, 2.0)).toBeCloseTo(1.0);
    expect(interpolateKeyframes(kfs, 3.0)).toBeCloseTo(0.5);
  });

  it('should handle unsorted keyframes', () => {
    const kfs: Keyframe[] = [
      { time: 4.0, value: 1.0, easing: 'linear' },
      { time: 0.0, value: 0.0, easing: 'linear' },
    ];
    expect(interpolateKeyframes(kfs, 2.0)).toBeCloseTo(0.5);
  });
});

describe('getEffectsAtTime', () => {
  it('should return base effects when no keyframes', () => {
    const clip = makeClip({ effects: { ...DEFAULT_EFFECTS, brightness: 1.5 } });
    const result = getEffectsAtTime(clip, 0);
    expect(result.brightness).toBe(1.5);
  });

  it('should return base effects when keyframes has fewer than 2 entries', () => {
    const clip = makeClip({
      effects: { ...DEFAULT_EFFECTS, brightness: 1.5 },
      keyframes: {
        brightness: [{ time: 1.0, value: 2.0, easing: 'linear' }],
      },
    });
    const result = getEffectsAtTime(clip, 1.0);
    expect(result.brightness).toBe(1.5);
  });

  it('should interpolate keyframed effect at given time', () => {
    const clip = makeClip({
      keyframes: {
        brightness: [
          { time: 0.0, value: 1.0, easing: 'linear' },
          { time: 4.0, value: 2.0, easing: 'linear' },
        ],
      },
    });
    const result = getEffectsAtTime(clip, 2.0);
    expect(result.brightness).toBeCloseTo(1.5);
  });

  it('should leave non-keyframed effects unchanged', () => {
    const clip = makeClip({
      effects: { ...DEFAULT_EFFECTS, contrast: 0.8 },
      keyframes: {
        brightness: [
          { time: 0.0, value: 1.0, easing: 'linear' },
          { time: 4.0, value: 2.0, easing: 'linear' },
        ],
      },
    });
    const result = getEffectsAtTime(clip, 2.0);
    expect(result.contrast).toBe(0.8);
    expect(result.brightness).toBeCloseTo(1.5);
  });
});

describe('hasActiveKeyframes', () => {
  it('should return false when no keyframes field', () => {
    expect(hasActiveKeyframes(makeClip())).toBe(false);
  });

  it('should return false when all keyframe arrays have fewer than 2 entries', () => {
    const clip = makeClip({
      keyframes: {
        brightness: [{ time: 0, value: 1.0, easing: 'linear' }],
      },
    });
    expect(hasActiveKeyframes(clip)).toBe(false);
  });

  it('should return true when any keyframe array has 2+ entries', () => {
    const clip = makeClip({
      keyframes: {
        brightness: [
          { time: 0, value: 1.0, easing: 'linear' },
          { time: 4, value: 2.0, easing: 'linear' },
        ],
      },
    });
    expect(hasActiveKeyframes(clip)).toBe(true);
  });
});
