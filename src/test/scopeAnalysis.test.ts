import { describe, it, expect } from 'vitest';
import { computeHistogram } from '../utils/scopeAnalysis';

describe('computeHistogram', () => {
  it('should count pixel values correctly for uniform color', () => {
    // 4 pixels of pure red (255, 0, 0, 255)
    const pixels = new Uint8ClampedArray([
      255, 0, 0, 255,
      255, 0, 0, 255,
      255, 0, 0, 255,
      255, 0, 0, 255,
    ]);
    const result = computeHistogram(pixels, 1);

    expect(result.r[255]).toBe(4);
    expect(result.g[0]).toBe(4);
    expect(result.b[0]).toBe(4);
    // luma for (255, 0, 0): (255*54 + 0*183 + 0*19) >> 8 = 13770 >> 8 = 53
    expect(result.luma[53]).toBe(4);
  });

  it('should count pixel values for mixed colors', () => {
    const pixels = new Uint8ClampedArray([
      255, 0, 0, 255,   // red
      0, 255, 0, 255,   // green
      0, 0, 255, 255,   // blue
      255, 255, 255, 255, // white
    ]);
    const result = computeHistogram(pixels, 1);

    expect(result.r[255]).toBe(2); // red + white
    expect(result.r[0]).toBe(2);   // green + blue
    expect(result.g[255]).toBe(2); // green + white
    expect(result.g[0]).toBe(2);   // red + blue
    expect(result.b[255]).toBe(2); // blue + white
    expect(result.b[0]).toBe(2);   // red + green
  });

  it('should downsample with step parameter', () => {
    // 8 pixels, step=2 should sample every 2nd pixel (4 samples)
    const pixels = new Uint8ClampedArray([
      100, 0, 0, 255,
      200, 0, 0, 255,
      100, 0, 0, 255,
      200, 0, 0, 255,
      100, 0, 0, 255,
      200, 0, 0, 255,
      100, 0, 0, 255,
      200, 0, 0, 255,
    ]);
    const result = computeHistogram(pixels, 2);

    // step=2: samples pixel 0, 2, 4, 6 (all r=100)
    expect(result.r[100]).toBe(4);
    expect(result.r[200]).toBe(0);
  });

  it('should return empty histogram for empty pixel data', () => {
    const pixels = new Uint8ClampedArray(0);
    const result = computeHistogram(pixels, 1);

    let total = 0;
    for (let i = 0; i < 256; i++) {
      total += result.r[i] + result.g[i] + result.b[i] + result.luma[i];
    }
    expect(total).toBe(0);
  });

  it('should compute correct luma for white pixels', () => {
    const pixels = new Uint8ClampedArray([255, 255, 255, 255]);
    const result = computeHistogram(pixels, 1);
    // luma: (255*54 + 255*183 + 255*19) >> 8 = 255*256 >> 8 = 255
    expect(result.luma[255]).toBe(1);
  });
});
