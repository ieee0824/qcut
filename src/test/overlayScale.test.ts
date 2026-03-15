import { describe, expect, it } from 'vitest';
import { getOverlayScale, scaleOverlayFontSize, scaleOverlayPixels } from '../utils/overlayScale';

describe('overlayScale', () => {
  it('returns 1 when preview height is invalid', () => {
    expect(getOverlayScale(0)).toBe(1);
    expect(getOverlayScale(Number.NaN)).toBe(1);
  });

  it('scales relative to the base preview height', () => {
    expect(getOverlayScale(360)).toBe(1);
    expect(getOverlayScale(720)).toBe(2);
    expect(getOverlayScale(180)).toBe(0.5);
  });

  it('scales font size and keeps a minimum readable size', () => {
    expect(scaleOverlayFontSize(24, 360)).toBe(24);
    expect(scaleOverlayFontSize(24, 720)).toBe(48);
    expect(scaleOverlayFontSize(16, 120)).toBe(8);
  });

  it('scales arbitrary pixel offsets', () => {
    expect(scaleOverlayPixels(20, 360)).toBe(20);
    expect(scaleOverlayPixels(20, 720)).toBe(40);
    expect(scaleOverlayPixels(20, 180)).toBe(10);
  });
});
