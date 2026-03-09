import { describe, it, expect } from 'vitest';
import { computeVectorscope } from '../utils/scopeAnalysis';

describe('computeVectorscope', () => {
  it('should return zero density for empty pixel data', () => {
    const pixels = new Uint8ClampedArray(0);
    const result = computeVectorscope(pixels, 1);
    expect(result.peak).toBe(0);
    let total = 0;
    for (let i = 0; i < result.density.length; i++) total += result.density[i];
    expect(total).toBe(0);
  });

  it('should place neutral gray at center (128,128)', () => {
    // 128,128,128 → Cb≈128, Cr≈128
    const pixels = new Uint8ClampedArray([128, 128, 128, 255]);
    const result = computeVectorscope(pixels, 1);
    // Cb = (-43*128 - 85*128 + 128*128) >> 8 + 128 = 0 + 128 = 128
    // Cr = (128*128 - 107*128 - 21*128) >> 8 + 128 = 0 + 128 = 128
    expect(result.density[128 * 256 + 128]).toBe(1);
    expect(result.peak).toBe(1);
  });

  it('should place pure white at center', () => {
    const pixels = new Uint8ClampedArray([255, 255, 255, 255]);
    const result = computeVectorscope(pixels, 1);
    // 白も無彩色なのでCb≈128, Cr≈128付近
    const cb = ((-43 * 255 - 85 * 255 + 128 * 255) >> 8) + 128;
    const cr = ((128 * 255 - 107 * 255 - 21 * 255) >> 8) + 128;
    expect(result.density[cr * 256 + cb]).toBe(1);
  });

  it('should place pure black at center', () => {
    const pixels = new Uint8ClampedArray([0, 0, 0, 255]);
    const result = computeVectorscope(pixels, 1);
    expect(result.density[128 * 256 + 128]).toBe(1);
  });

  it('should place pure red away from center', () => {
    const pixels = new Uint8ClampedArray([255, 0, 0, 255]);
    const result = computeVectorscope(pixels, 1);
    const cb = ((-43 * 255) >> 8) + 128; // ≈ 85
    const cr = ((128 * 255) >> 8) + 128; // ≈ 255 → clamped to 255
    const cbClamped = Math.max(0, Math.min(255, cb));
    const crClamped = Math.max(0, Math.min(255, cr));
    expect(result.density[crClamped * 256 + cbClamped]).toBe(1);
    expect(result.peak).toBe(1);
  });

  it('should accumulate multiple pixels at same color', () => {
    const pixels = new Uint8ClampedArray([
      128, 128, 128, 255,
      128, 128, 128, 255,
      128, 128, 128, 255,
    ]);
    const result = computeVectorscope(pixels, 1);
    expect(result.density[128 * 256 + 128]).toBe(3);
    expect(result.peak).toBe(3);
  });

  it('should downsample with step parameter', () => {
    const pixels = new Uint8ClampedArray([
      128, 128, 128, 255,
      200, 100, 50, 255,
      128, 128, 128, 255,
      200, 100, 50, 255,
    ]);
    // step=2: samples pixel 0 and 2 only
    const result = computeVectorscope(pixels, 2);
    expect(result.density[128 * 256 + 128]).toBe(2);
  });

  it('should clamp step=0 to 1', () => {
    const pixels = new Uint8ClampedArray([128, 128, 128, 255]);
    const result = computeVectorscope(pixels, 0);
    expect(result.peak).toBe(1);
  });

  it('should handle pixel data shorter than 4 bytes', () => {
    const pixels = new Uint8ClampedArray([10, 20]);
    const result = computeVectorscope(pixels, 1);
    expect(result.peak).toBe(0);
  });

  it('should return density array of 256*256 length', () => {
    const pixels = new Uint8ClampedArray([100, 150, 200, 255]);
    const result = computeVectorscope(pixels, 1);
    expect(result.density.length).toBe(256 * 256);
  });
});
