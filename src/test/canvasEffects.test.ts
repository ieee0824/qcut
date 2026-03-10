import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_EFFECTS } from '../store/timelineStore';
import { needsCanvasPipeline, initWebGLPipeline } from '../components/VideoPreview/canvasEffects';

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

  it('should return true when blurAmount is non-zero', () => {
    expect(needsCanvasPipeline({ ...DEFAULT_EFFECTS, blurAmount: 5 })).toBe(true);
  });

  it('should return true when sharpenAmount is non-zero', () => {
    expect(needsCanvasPipeline({ ...DEFAULT_EFFECTS, sharpenAmount: 1.5 })).toBe(true);
  });

  it('should return true when monochrome is non-zero', () => {
    expect(needsCanvasPipeline({ ...DEFAULT_EFFECTS, monochrome: 1 })).toBe(true);
  });

  it('should return false when filter values are within epsilon', () => {
    expect(needsCanvasPipeline({
      ...DEFAULT_EFFECTS,
      blurAmount: 0.0005,
      sharpenAmount: 0.0001,
      monochrome: 0.0005,
    })).toBe(false);
  });
});

describe('initWebGLPipeline', () => {
  it('should request preserveDrawingBuffer: true', () => {
    const getContext = vi.fn().mockReturnValue(null);
    const canvas = { getContext } as unknown as HTMLCanvasElement;

    initWebGLPipeline(canvas);

    expect(getContext).toHaveBeenCalledWith('webgl', {
      premultipliedAlpha: false,
      alpha: false,
      preserveDrawingBuffer: true,
    });
  });

  it('should return null when getContext returns null', () => {
    const getContext = vi.fn().mockReturnValue(null);
    const canvas = { getContext } as unknown as HTMLCanvasElement;

    expect(initWebGLPipeline(canvas)).toBeNull();
  });
});
