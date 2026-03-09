import { describe, it, expect } from 'vitest';
import { DEFAULT_EFFECTS } from '../store/timelineStore';
import { needsCanvasPipeline } from '../components/VideoPreview/canvasEffects';

describe('Color Wheel (Lift/Gamma/Gain) effects', () => {
  describe('DEFAULT_EFFECTS', () => {
    it('should have lift R/G/B defaults at 0', () => {
      expect(DEFAULT_EFFECTS.liftR).toBe(0);
      expect(DEFAULT_EFFECTS.liftG).toBe(0);
      expect(DEFAULT_EFFECTS.liftB).toBe(0);
    });

    it('should have gamma R/G/B defaults at 0', () => {
      expect(DEFAULT_EFFECTS.gammaR).toBe(0);
      expect(DEFAULT_EFFECTS.gammaG).toBe(0);
      expect(DEFAULT_EFFECTS.gammaB).toBe(0);
    });

    it('should have gain R/G/B defaults at 0', () => {
      expect(DEFAULT_EFFECTS.gainR).toBe(0);
      expect(DEFAULT_EFFECTS.gainG).toBe(0);
      expect(DEFAULT_EFFECTS.gainB).toBe(0);
    });
  });

  describe('needsCanvasPipeline with lift/gamma/gain', () => {
    it('should return false for default effects', () => {
      expect(needsCanvasPipeline(DEFAULT_EFFECTS)).toBe(false);
    });

    it('should return true when liftR is non-zero', () => {
      expect(needsCanvasPipeline({ ...DEFAULT_EFFECTS, liftR: 0.3 })).toBe(true);
    });

    it('should return true when liftG is non-zero', () => {
      expect(needsCanvasPipeline({ ...DEFAULT_EFFECTS, liftG: -0.5 })).toBe(true);
    });

    it('should return true when liftB is non-zero', () => {
      expect(needsCanvasPipeline({ ...DEFAULT_EFFECTS, liftB: 0.2 })).toBe(true);
    });

    it('should return true when gammaR is non-zero', () => {
      expect(needsCanvasPipeline({ ...DEFAULT_EFFECTS, gammaR: 0.4 })).toBe(true);
    });

    it('should return true when gammaG is non-zero', () => {
      expect(needsCanvasPipeline({ ...DEFAULT_EFFECTS, gammaG: -0.2 })).toBe(true);
    });

    it('should return true when gammaB is non-zero', () => {
      expect(needsCanvasPipeline({ ...DEFAULT_EFFECTS, gammaB: 0.1 })).toBe(true);
    });

    it('should return true when gainR is non-zero', () => {
      expect(needsCanvasPipeline({ ...DEFAULT_EFFECTS, gainR: 0.6 })).toBe(true);
    });

    it('should return true when gainG is non-zero', () => {
      expect(needsCanvasPipeline({ ...DEFAULT_EFFECTS, gainG: -0.3 })).toBe(true);
    });

    it('should return true when gainB is non-zero', () => {
      expect(needsCanvasPipeline({ ...DEFAULT_EFFECTS, gainB: 0.8 })).toBe(true);
    });

    it('should return false when lift/gamma/gain values are within epsilon', () => {
      expect(needsCanvasPipeline({
        ...DEFAULT_EFFECTS,
        liftR: 0.0005,
        gammaG: -0.0001,
        gainB: 0.0009,
      })).toBe(false);
    });

    it('should store and retrieve lift/gamma/gain values', () => {
      const effects = {
        ...DEFAULT_EFFECTS,
        liftR: 0.3,
        liftG: -0.1,
        liftB: 0.2,
        gammaR: -0.5,
        gammaG: 0.4,
        gammaB: 0.0,
        gainR: 0.7,
        gainG: 0.0,
        gainB: -0.6,
      };

      expect(effects.liftR).toBe(0.3);
      expect(effects.liftG).toBe(-0.1);
      expect(effects.liftB).toBe(0.2);
      expect(effects.gammaR).toBe(-0.5);
      expect(effects.gammaG).toBe(0.4);
      expect(effects.gammaB).toBe(0.0);
      expect(effects.gainR).toBe(0.7);
      expect(effects.gainG).toBe(0.0);
      expect(effects.gainB).toBe(-0.6);
    });

    it('should serialize to JSON correctly', () => {
      const effects = {
        ...DEFAULT_EFFECTS,
        liftR: 0.5,
        gammaG: -0.3,
        gainB: 0.8,
      };
      const json = JSON.stringify(effects);
      const parsed = JSON.parse(json);
      expect(parsed.liftR).toBe(0.5);
      expect(parsed.gammaG).toBe(-0.3);
      expect(parsed.gainB).toBe(0.8);
    });
  });
});
