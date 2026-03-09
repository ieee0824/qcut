import { describe, it, expect } from 'vitest';
import { computeWaveform } from '../utils/scopeAnalysis';

describe('computeWaveform', () => {
  it('should return zero density for empty pixel data', () => {
    const pixels = new Uint8ClampedArray(0);
    const result = computeWaveform(pixels, 4, 1);
    expect(result.peak).toBe(0);
    expect(result.columns).toBe(4);
  });

  it('should compute luma density per column', () => {
    // 2x1 image: pixel 0 = white, pixel 1 = black
    const pixels = new Uint8ClampedArray([
      255, 255, 255, 255, // col 0: luma=255
      0, 0, 0, 255,       // col 1: luma=0
    ]);
    const result = computeWaveform(pixels, 2, 1);
    expect(result.columns).toBe(2);
    // col 0, luma 255
    expect(result.density[0 * 256 + 255]).toBe(1);
    // col 1, luma 0
    expect(result.density[1 * 256 + 0]).toBe(1);
    expect(result.peak).toBe(1);
  });

  it('should accumulate multiple rows in same column', () => {
    // 2x2 image, width=2
    const pixels = new Uint8ClampedArray([
      255, 255, 255, 255, // row 0, col 0: luma=255
      0, 0, 0, 255,       // row 0, col 1: luma=0
      255, 255, 255, 255, // row 1, col 0: luma=255
      128, 128, 128, 255, // row 1, col 1: luma=128
    ]);
    const result = computeWaveform(pixels, 2, 1);
    // col 0 has two white pixels
    expect(result.density[0 * 256 + 255]).toBe(2);
    expect(result.peak).toBe(2);
  });

  it('should compute correct luma for colored pixels', () => {
    // 1x1 pure red
    const pixels = new Uint8ClampedArray([255, 0, 0, 255]);
    const result = computeWaveform(pixels, 1, 1);
    // luma = (255*54 + 0*183 + 0*19) >> 8 = 53
    expect(result.density[0 * 256 + 53]).toBe(1);
  });

  it('should downsample with step parameter', () => {
    // 4x1 image
    const pixels = new Uint8ClampedArray([
      255, 255, 255, 255,
      128, 128, 128, 255,
      255, 255, 255, 255,
      128, 128, 128, 255,
    ]);
    // step=2: samples pixel 0 and 2
    const result = computeWaveform(pixels, 4, 2);
    expect(result.density[0 * 256 + 255]).toBe(1);
    expect(result.density[2 * 256 + 255]).toBe(1);
    // pixel 1 and 3 skipped
    const luma128 = (128 * 54 + 128 * 183 + 128 * 19) >> 8;
    expect(result.density[1 * 256 + luma128]).toBe(0);
  });

  it('should clamp step=0 to 1', () => {
    const pixels = new Uint8ClampedArray([128, 128, 128, 255]);
    const result = computeWaveform(pixels, 1, 0);
    expect(result.peak).toBe(1);
  });

  it('should handle pixel data shorter than 4 bytes', () => {
    const pixels = new Uint8ClampedArray([10, 20]);
    const result = computeWaveform(pixels, 1, 1);
    expect(result.peak).toBe(0);
  });

  it('should return correct density array size', () => {
    const pixels = new Uint8ClampedArray([100, 150, 200, 255]);
    const result = computeWaveform(pixels, 1, 1);
    expect(result.density.length).toBe(1 * 256);
  });

  it('should handle width larger than pixel count', () => {
    // width=4 but only 1 pixel of data
    const pixels = new Uint8ClampedArray([128, 128, 128, 255]);
    const result = computeWaveform(pixels, 4, 1);
    expect(result.columns).toBe(4);
    const luma = (128 * 54 + 128 * 183 + 128 * 19) >> 8;
    expect(result.density[0 * 256 + luma]).toBe(1);
  });
});
