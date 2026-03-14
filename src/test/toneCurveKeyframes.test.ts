import { describe, it, expect } from 'vitest';
import {
  interpolateToneCurveLUTs,
  getToneCurvesAtTime,
  hasActiveToneCurveKeyframes,
} from '../utils/toneCurveKeyframes';
import type { ToneCurves, ToneCurveKeyframe, CurvePoint } from '../store/timeline/types';
import { DEFAULT_TONE_CURVES } from '../store/timeline/types';

const linearCurve: CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
];

const brightCurve: CurvePoint[] = [
  { x: 0, y: 0.2 },
  { x: 1, y: 1 },
];

const darkCurve: CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0.8 },
];

const makeToneCurves = (rgb: CurvePoint[]): ToneCurves => ({
  rgb,
  r: [...linearCurve],
  g: [...linearCurve],
  b: [...linearCurve],
});

describe('interpolateToneCurveLUTs', () => {
  it('should return LUT A when t=0', () => {
    const lutA = new Float32Array([0, 0.5, 1.0]);
    const lutB = new Float32Array([0.2, 0.7, 0.8]);
    const result = interpolateToneCurveLUTs(lutA, lutB, 0);
    expect(result[0]).toBeCloseTo(0);
    expect(result[1]).toBeCloseTo(0.5);
    expect(result[2]).toBeCloseTo(1.0);
  });

  it('should return LUT B when t=1', () => {
    const lutA = new Float32Array([0, 0.5, 1.0]);
    const lutB = new Float32Array([0.2, 0.7, 0.8]);
    const result = interpolateToneCurveLUTs(lutA, lutB, 1);
    expect(result[0]).toBeCloseTo(0.2);
    expect(result[1]).toBeCloseTo(0.7);
    expect(result[2]).toBeCloseTo(0.8);
  });

  it('should linearly interpolate LUT values at t=0.5', () => {
    const lutA = new Float32Array([0, 0.4, 1.0]);
    const lutB = new Float32Array([0.2, 0.8, 0.6]);
    const result = interpolateToneCurveLUTs(lutA, lutB, 0.5);
    expect(result[0]).toBeCloseTo(0.1);
    expect(result[1]).toBeCloseTo(0.6);
    expect(result[2]).toBeCloseTo(0.8);
  });

  it('should handle t=0.25', () => {
    const lutA = new Float32Array([0, 1.0]);
    const lutB = new Float32Array([1.0, 0]);
    const result = interpolateToneCurveLUTs(lutA, lutB, 0.25);
    expect(result[0]).toBeCloseTo(0.25);
    expect(result[1]).toBeCloseTo(0.75);
  });
});

describe('getToneCurvesAtTime', () => {
  it('should return null for empty keyframes', () => {
    expect(getToneCurvesAtTime([], 1.0)).toBeNull();
  });

  it('should return null for single keyframe (not enough for interpolation)', () => {
    const kfs: ToneCurveKeyframe[] = [
      { time: 1.0, toneCurves: makeToneCurves(brightCurve), easing: 'linear' },
    ];
    expect(getToneCurvesAtTime(kfs, 1.0)).toBeNull();
  });

  it('should return first keyframe curves when time is before first keyframe', () => {
    const kfs: ToneCurveKeyframe[] = [
      { time: 2.0, toneCurves: makeToneCurves(brightCurve), easing: 'linear' },
      { time: 4.0, toneCurves: makeToneCurves(darkCurve), easing: 'linear' },
    ];
    const result = getToneCurvesAtTime(kfs, 0);
    expect(result).not.toBeNull();
    expect(result!.rgb).toEqual(brightCurve);
  });

  it('should return last keyframe curves when time is after last keyframe', () => {
    const kfs: ToneCurveKeyframe[] = [
      { time: 2.0, toneCurves: makeToneCurves(brightCurve), easing: 'linear' },
      { time: 4.0, toneCurves: makeToneCurves(darkCurve), easing: 'linear' },
    ];
    const result = getToneCurvesAtTime(kfs, 5.0);
    expect(result).not.toBeNull();
    expect(result!.rgb).toEqual(darkCurve);
  });

  it('should interpolate LUTs between two keyframes at midpoint', () => {
    const curvesA = makeToneCurves(linearCurve);
    const curvesB: ToneCurves = {
      rgb: [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }], // flat at 0.5
      r: [...linearCurve],
      g: [...linearCurve],
      b: [...linearCurve],
    };
    const kfs: ToneCurveKeyframe[] = [
      { time: 0, toneCurves: curvesA, easing: 'linear' },
      { time: 4, toneCurves: curvesB, easing: 'linear' },
    ];
    const result = getToneCurvesAtTime(kfs, 2.0);
    expect(result).not.toBeNull();
    // At t=0.5, the interpolated LUT should be between linear and flat-0.5
    // For index 0 (input 0): linear gives 0, flat gives 0.5 → 0.25
    expect(result!.rgbLUT[0]).toBeCloseTo(0.25, 1);
    // For index 255 (input 1): linear gives 1, flat gives 0.5 → 0.75
    expect(result!.rgbLUT[255]).toBeCloseTo(0.75, 1);
  });

  it('should interpolate all four channels independently', () => {
    const curvesA: ToneCurves = {
      rgb: [...linearCurve],
      r: [{ x: 0, y: 0 }, { x: 1, y: 0.5 }],
      g: [...linearCurve],
      b: [...linearCurve],
    };
    const curvesB: ToneCurves = {
      rgb: [...linearCurve],
      r: [{ x: 0, y: 0 }, { x: 1, y: 1.0 }],
      g: [...linearCurve],
      b: [...linearCurve],
    };
    const kfs: ToneCurveKeyframe[] = [
      { time: 0, toneCurves: curvesA, easing: 'linear' },
      { time: 4, toneCurves: curvesB, easing: 'linear' },
    ];
    const result = getToneCurvesAtTime(kfs, 2.0);
    expect(result).not.toBeNull();
    // R channel at input=1: 0.5 + (1.0 - 0.5) * 0.5 = 0.75
    expect(result!.rLUT[255]).toBeCloseTo(0.75, 1);
    // RGB channel should remain linear (both keyframes have linear RGB)
    expect(result!.rgbLUT[255]).toBeCloseTo(1.0, 1);
  });
});

describe('getToneCurvesAtTime — トーンカーブKFのみのクリップ', () => {
  // Bug fix #1: トーンカーブKFだけが有効なクリップで renderFrame まで到達しない問題の検証
  // hasActiveToneCurveKeyframes が true を返す場合、getToneCurvesAtTime は有効な LUT を返す必要がある
  it('should return valid LUTs for tone-curve-only keyframes (no effect keyframes)', () => {
    const kfs: ToneCurveKeyframe[] = [
      { time: 0, toneCurves: makeToneCurves(brightCurve), easing: 'linear' },
      { time: 4, toneCurves: makeToneCurves(darkCurve), easing: 'linear' },
    ];
    expect(hasActiveToneCurveKeyframes(kfs)).toBe(true);
    const result = getToneCurvesAtTime(kfs, 2.0);
    expect(result).not.toBeNull();
    expect(result!.rgbLUT).toBeInstanceOf(Float32Array);
    expect(result!.rgbLUT.length).toBe(256);
    expect(result!.rLUT.length).toBe(256);
    expect(result!.gLUT.length).toBe(256);
    expect(result!.bLUT.length).toBe(256);
  });

  it('should return exact keyframe LUT when time matches keyframe exactly', () => {
    const kfs: ToneCurveKeyframe[] = [
      { time: 0, toneCurves: makeToneCurves(brightCurve), easing: 'linear' },
      { time: 4, toneCurves: makeToneCurves(darkCurve), easing: 'linear' },
    ];
    // time=0 のキーフレームの値を返す
    const result = getToneCurvesAtTime(kfs, 0);
    expect(result).not.toBeNull();
    expect(result!.rgb).toEqual(brightCurve);
    // time=4 のキーフレームの値を返す
    const result2 = getToneCurvesAtTime(kfs, 4);
    expect(result2).not.toBeNull();
    expect(result2!.rgb).toEqual(darkCurve);
  });
});

describe('hasActiveToneCurveKeyframes', () => {
  it('should return false for undefined', () => {
    expect(hasActiveToneCurveKeyframes(undefined)).toBe(false);
  });

  it('should return false for empty array', () => {
    expect(hasActiveToneCurveKeyframes([])).toBe(false);
  });

  it('should return false for single keyframe', () => {
    const kfs: ToneCurveKeyframe[] = [
      { time: 0, toneCurves: DEFAULT_TONE_CURVES, easing: 'linear' },
    ];
    expect(hasActiveToneCurveKeyframes(kfs)).toBe(false);
  });

  it('should return true for 2+ keyframes', () => {
    const kfs: ToneCurveKeyframe[] = [
      { time: 0, toneCurves: DEFAULT_TONE_CURVES, easing: 'linear' },
      { time: 4, toneCurves: DEFAULT_TONE_CURVES, easing: 'linear' },
    ];
    expect(hasActiveToneCurveKeyframes(kfs)).toBe(true);
  });
});
