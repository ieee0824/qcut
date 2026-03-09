import { describe, it, expect } from 'vitest';
import { DEFAULT_EFFECTS } from '../store/timelineStore';
import { needsCanvasPipeline } from '../components/VideoPreview/canvasEffects';

describe('needsCanvasPipeline', () => {
  it('should return false for default effects', () => {
    expect(needsCanvasPipeline(DEFAULT_EFFECTS)).toBe(false);
  });

  it('should return false for basic CSS-only effects', () => {
    expect(needsCanvasPipeline({
      ...DEFAULT_EFFECTS,
      brightness: 1.5,
      contrast: 0.8,
      saturation: 1.2,
      hue: 45,
      colorTemperature: 0.5,
    })).toBe(false);
  });

  it('should return true when hslRedSat is non-zero', () => {
    expect(needsCanvasPipeline({ ...DEFAULT_EFFECTS, hslRedSat: 0.5 })).toBe(true);
  });

  it('should return true when hslYellowSat is non-zero', () => {
    expect(needsCanvasPipeline({ ...DEFAULT_EFFECTS, hslYellowSat: -0.3 })).toBe(true);
  });

  it('should return true when hslGreenSat is non-zero', () => {
    expect(needsCanvasPipeline({ ...DEFAULT_EFFECTS, hslGreenSat: 0.1 })).toBe(true);
  });

  it('should return true when hslCyanSat is non-zero', () => {
    expect(needsCanvasPipeline({ ...DEFAULT_EFFECTS, hslCyanSat: -1.0 })).toBe(true);
  });

  it('should return true when hslBlueSat is non-zero', () => {
    expect(needsCanvasPipeline({ ...DEFAULT_EFFECTS, hslBlueSat: 0.8 })).toBe(true);
  });

  it('should return true when hslMagentaSat is non-zero', () => {
    expect(needsCanvasPipeline({ ...DEFAULT_EFFECTS, hslMagentaSat: 0.2 })).toBe(true);
  });

  it('should return false when HSL values are within epsilon', () => {
    expect(needsCanvasPipeline({
      ...DEFAULT_EFFECTS,
      hslRedSat: 0.0005,
      hslBlueSat: -0.0001,
    })).toBe(false);
  });

  it('should return true when multiple HSL values are non-zero', () => {
    expect(needsCanvasPipeline({
      ...DEFAULT_EFFECTS,
      hslRedSat: 0.5,
      hslGreenSat: -0.3,
      hslBlueSat: 0.8,
    })).toBe(true);
  });
});
