import { describe, expect, it } from 'vitest';
import { normalizePreset } from '../store/effectPresetStore';

describe('normalizePreset', () => {
  it('returns a valid EffectPreset from well-formed input', () => {
    const input = {
      id: 'preset-1',
      name: 'My Preset',
      category: 'voice',
      effects: { brightness: 1.5 },
    };
    const result = normalizePreset(input);
    expect(result).toEqual({
      id: 'preset-1',
      name: 'My Preset',
      category: 'voice',
      effects: { brightness: 1.5 },
      isBuiltIn: false,
    });
  });

  it('defaults category to "custom" when category is invalid', () => {
    const input = { id: 'p-1', name: 'X', category: 'unknown', effects: {} };
    const result = normalizePreset(input);
    expect(result?.category).toBe('custom');
  });

  it('defaults category to "custom" when category is missing', () => {
    const input = { id: 'p-1', name: 'X', effects: {} };
    const result = normalizePreset(input);
    expect(result?.category).toBe('custom');
  });

  it('returns null when id is missing', () => {
    expect(normalizePreset({ name: 'No ID', effects: {} })).toBeNull();
  });

  it('returns null when id is empty string', () => {
    expect(normalizePreset({ id: '', name: 'Empty', effects: {} })).toBeNull();
  });

  it('returns null for null input', () => {
    expect(normalizePreset(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normalizePreset(undefined)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(normalizePreset('string')).toBeNull();
    expect(normalizePreset(42)).toBeNull();
  });

  it('defaults name to empty string when name is not a string', () => {
    const result = normalizePreset({ id: 'p-1', name: 123 });
    expect(result?.name).toBe('');
  });

  it('defaults effects to empty object when effects is not an object', () => {
    const result = normalizePreset({ id: 'p-1', name: 'X', effects: 'bad' });
    expect(result?.effects).toEqual({});
  });

  it('defaults effects to empty object when effects is an array', () => {
    const result = normalizePreset({ id: 'p-1', name: 'X', effects: [1, 2] });
    expect(result?.effects).toEqual({});
  });

  it('always sets isBuiltIn to false', () => {
    const input = { id: 'p-1', name: 'X', isBuiltIn: true };
    const result = normalizePreset(input);
    expect(result?.isBuiltIn).toBe(false);
  });

  it('accepts all valid categories', () => {
    for (const category of ['voice', 'music', 'scene', 'custom']) {
      const result = normalizePreset({ id: 'p-1', name: 'X', category });
      expect(result?.category).toBe(category);
    }
  });

  it('is referentially transparent: same input produces same output', () => {
    const input = { id: 'p-1', name: 'Preset', category: 'music', effects: { contrast: 1.2 } };
    const result1 = normalizePreset(input);
    const result2 = normalizePreset(input);
    expect(result1).toEqual(result2);
  });

  it('does not mutate the input object', () => {
    const input = { id: 'p-1', name: 'Orig', category: 'voice', effects: { brightness: 1.0 }, isBuiltIn: true };
    const snapshot = JSON.parse(JSON.stringify(input));
    normalizePreset(input);
    expect(input).toEqual(snapshot);
  });
});
