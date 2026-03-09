import { describe, it, expect } from 'vitest';
import { BUILT_IN_COLOR_PRESETS } from '../data/colorPresets';
import type { ColorEffectFields } from '../data/colorPresets';
import { DEFAULT_EFFECTS } from '../store/timelineStore';
import type { ClipEffects } from '../store/timelineStore';

const COLOR_EFFECT_KEYS: (keyof ColorEffectFields)[] = [
  'brightness', 'contrast', 'saturation', 'colorTemperature', 'hue',
  'hslRedSat', 'hslYellowSat', 'hslGreenSat', 'hslCyanSat', 'hslBlueSat', 'hslMagentaSat',
  'liftR', 'liftG', 'liftB', 'gammaR', 'gammaG', 'gammaB', 'gainR', 'gainG', 'gainB',
];

function applyPresetToEffects(
  baseEffects: ClipEffects,
  presetEffects: Partial<ColorEffectFields>,
): ClipEffects {
  const updates: Partial<ClipEffects> = {};
  for (const key of COLOR_EFFECT_KEYS) {
    if (key in presetEffects) {
      updates[key] = presetEffects[key] as number;
    } else {
      updates[key] = DEFAULT_EFFECTS[key];
    }
  }
  return { ...baseEffects, ...updates };
}

describe('colorPresets', () => {
  it('should have unique ids for all built-in presets', () => {
    const ids = BUILT_IN_COLOR_PRESETS.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have all built-in presets marked as isBuiltIn', () => {
    for (const preset of BUILT_IN_COLOR_PRESETS) {
      expect(preset.isBuiltIn).toBe(true);
    }
  });

  it('should have valid categories', () => {
    const validCategories = ['cinematic', 'vintage', 'monochrome', 'creative'];
    for (const preset of BUILT_IN_COLOR_PRESETS) {
      expect(validCategories).toContain(preset.category);
    }
  });

  it('should only contain valid color effect keys', () => {
    for (const preset of BUILT_IN_COLOR_PRESETS) {
      for (const key of Object.keys(preset.effects)) {
        expect(COLOR_EFFECT_KEYS).toContain(key);
      }
    }
  });

  it('should apply preset effects to clip', () => {
    const preset = BUILT_IN_COLOR_PRESETS[0]; // cinematic warm
    const result = applyPresetToEffects(DEFAULT_EFFECTS, preset.effects);

    // プリセットに含まれるフィールドが適用されている
    for (const [key, value] of Object.entries(preset.effects)) {
      expect(result[key as keyof ClipEffects]).toBe(value);
    }
  });

  it('should reset non-preset fields to defaults', () => {
    const modified: ClipEffects = { ...DEFAULT_EFFECTS, hue: 45, hslRedSat: 0.5 };
    const preset = BUILT_IN_COLOR_PRESETS.find(p => p.id === 'builtin-monochrome')!;
    const result = applyPresetToEffects(modified, preset.effects);

    // プリセットに含まれないカラーフィールドはデフォルトに戻る
    expect(result.hue).toBe(DEFAULT_EFFECTS.hue);
    expect(result.hslRedSat).toBe(DEFAULT_EFFECTS.hslRedSat);
  });

  it('should preserve non-color fields', () => {
    const modified: ClipEffects = { ...DEFAULT_EFFECTS, volume: 0.5, rotation: 90 };
    const preset = BUILT_IN_COLOR_PRESETS[0];
    const result = applyPresetToEffects(modified, preset.effects);

    // オーディオ・トランスフォームは変わらない
    expect(result.volume).toBe(0.5);
    expect(result.rotation).toBe(90);
  });

  it('should have at least 10 built-in presets', () => {
    expect(BUILT_IN_COLOR_PRESETS.length).toBeGreaterThanOrEqual(10);
  });
});
