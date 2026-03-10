import { describe, it, expect } from 'vitest';
import { buildCurveLUT, isDefaultCurve } from '../utils/curveSpline';
import type { CurvePoint } from '../store/timelineStore';

describe('buildCurveLUT', () => {
  it('should return linear LUT for default 2-point curve', () => {
    const points: CurvePoint[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    const lut = buildCurveLUT(points, 256);
    expect(lut.length).toBe(256);
    expect(lut[0]).toBeCloseTo(0, 4);
    expect(lut[127]).toBeCloseTo(127 / 255, 2);
    expect(lut[255]).toBeCloseTo(1, 4);
  });

  it('should return linear LUT for empty points', () => {
    const lut = buildCurveLUT([], 256);
    expect(lut[0]).toBeCloseTo(0, 4);
    expect(lut[255]).toBeCloseTo(1, 4);
  });

  it('should return linear LUT for single point', () => {
    const lut = buildCurveLUT([{ x: 0.5, y: 0.5 }], 256);
    expect(lut[0]).toBeCloseTo(0, 4);
    expect(lut[255]).toBeCloseTo(1, 4);
  });

  it('should produce brighten curve when midpoint is raised', () => {
    const points: CurvePoint[] = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.75 },
      { x: 1, y: 1 },
    ];
    const lut = buildCurveLUT(points, 256);
    // 中間値が持ち上がっている
    const mid = lut[128]; // x ≈ 0.502
    expect(mid).toBeGreaterThan(0.55);
    // 端点はそのまま
    expect(lut[0]).toBeCloseTo(0, 4);
    expect(lut[255]).toBeCloseTo(1, 4);
  });

  it('should produce darken curve when midpoint is lowered', () => {
    const points: CurvePoint[] = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.25 },
      { x: 1, y: 1 },
    ];
    const lut = buildCurveLUT(points, 256);
    const mid = lut[128];
    expect(mid).toBeLessThan(0.45);
  });

  it('should clamp output to 0-1 range', () => {
    // 極端なカーブでもクランプされる
    const points: CurvePoint[] = [
      { x: 0, y: 0 },
      { x: 0.25, y: 0.9 },
      { x: 0.75, y: 0.1 },
      { x: 1, y: 1 },
    ];
    const lut = buildCurveLUT(points, 256);
    for (let i = 0; i < 256; i++) {
      expect(lut[i]).toBeGreaterThanOrEqual(0);
      expect(lut[i]).toBeLessThanOrEqual(1);
    }
  });

  it('should handle S-curve with 4 points', () => {
    const points: CurvePoint[] = [
      { x: 0, y: 0 },
      { x: 0.25, y: 0.15 },
      { x: 0.75, y: 0.85 },
      { x: 1, y: 1 },
    ];
    const lut = buildCurveLUT(points, 256);
    // シャドウは暗め、ハイライトは明るめ（S字）
    expect(lut[64]).toBeLessThan(64 / 255);  // x ≈ 0.25
    expect(lut[191]).toBeGreaterThan(191 / 255);  // x ≈ 0.75
  });

  it('should produce monotonically increasing LUT for 2-point curve', () => {
    const points: CurvePoint[] = [
      { x: 0, y: 0.2 },
      { x: 1, y: 0.8 },
    ];
    const lut = buildCurveLUT(points, 256);
    for (let i = 1; i < 256; i++) {
      expect(lut[i]).toBeGreaterThanOrEqual(lut[i - 1] - 1e-6);
    }
  });

  it('should work with custom size', () => {
    const points: CurvePoint[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    const lut = buildCurveLUT(points, 16);
    expect(lut.length).toBe(16);
    expect(lut[0]).toBeCloseTo(0, 4);
    expect(lut[15]).toBeCloseTo(1, 4);
  });
});

describe('isDefaultCurve', () => {
  it('should return true for default linear curve', () => {
    expect(isDefaultCurve([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(true);
  });

  it('should return false for modified curve', () => {
    expect(isDefaultCurve([{ x: 0, y: 0 }, { x: 0.5, y: 0.7 }, { x: 1, y: 1 }])).toBe(false);
  });

  it('should return false for single point', () => {
    expect(isDefaultCurve([{ x: 0, y: 0 }])).toBe(false);
  });

  it('should return false for moved endpoint', () => {
    expect(isDefaultCurve([{ x: 0, y: 0.1 }, { x: 1, y: 1 }])).toBe(false);
  });
});
