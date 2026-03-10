import { describe, it, expect, beforeEach } from 'vitest';
import { useEffectPresetStore } from '../store/effectPresetStore';
import { BUILT_IN_EFFECT_PRESETS } from '../data/effectPresets';

describe('effectPresetStore', () => {
  beforeEach(() => {
    useEffectPresetStore.setState({
      customPresets: [],
      loaded: false,
    });
  });

  it('should have empty custom presets by default', () => {
    expect(useEffectPresetStore.getState().customPresets).toEqual([]);
  });

  it('should not be loaded by default', () => {
    expect(useEffectPresetStore.getState().loaded).toBe(false);
  });

  it('should return built-in presets from getAllPresets', () => {
    const all = useEffectPresetStore.getState().getAllPresets();
    expect(all.length).toBe(BUILT_IN_EFFECT_PRESETS.length);
    expect(all[0].isBuiltIn).toBe(true);
  });

  it('should add a custom preset', async () => {
    await useEffectPresetStore.getState().addPreset('My Preset', { volume: 1.5, eqLow: 3 });
    const customs = useEffectPresetStore.getState().customPresets;
    expect(customs.length).toBe(1);
    expect(customs[0].name).toBe('My Preset');
    expect(customs[0].category).toBe('custom');
    expect(customs[0].isBuiltIn).toBe(false);
    expect(customs[0].effects.volume).toBe(1.5);
    expect(customs[0].effects.eqLow).toBe(3);
  });

  it('should generate unique id for custom preset', async () => {
    await useEffectPresetStore.getState().addPreset('A', {});
    await useEffectPresetStore.getState().addPreset('B', {});
    const customs = useEffectPresetStore.getState().customPresets;
    expect(customs[0].id).not.toBe(customs[1].id);
    expect(customs[0].id.startsWith('custom-')).toBe(true);
  });

  it('should include custom presets in getAllPresets', async () => {
    await useEffectPresetStore.getState().addPreset('Custom', { volume: 0.5 });
    const all = useEffectPresetStore.getState().getAllPresets();
    expect(all.length).toBe(BUILT_IN_EFFECT_PRESETS.length + 1);
    expect(all[all.length - 1].name).toBe('Custom');
  });

  it('should remove a custom preset', async () => {
    await useEffectPresetStore.getState().addPreset('ToDelete', {});
    const id = useEffectPresetStore.getState().customPresets[0].id;
    await useEffectPresetStore.getState().removePreset(id);
    expect(useEffectPresetStore.getState().customPresets.length).toBe(0);
  });

  it('should not remove built-in presets from getAllPresets after removing custom', async () => {
    await useEffectPresetStore.getState().addPreset('Temp', {});
    const id = useEffectPresetStore.getState().customPresets[0].id;
    await useEffectPresetStore.getState().removePreset(id);
    const all = useEffectPresetStore.getState().getAllPresets();
    expect(all.length).toBe(BUILT_IN_EFFECT_PRESETS.length);
  });

  it('should have built-in presets with correct categories', () => {
    const all = useEffectPresetStore.getState().getAllPresets();
    const voicePresets = all.filter(p => p.category === 'voice');
    const musicPresets = all.filter(p => p.category === 'music');
    const scenePresets = all.filter(p => p.category === 'scene');
    expect(voicePresets.length).toBeGreaterThan(0);
    expect(musicPresets.length).toBeGreaterThan(0);
    expect(scenePresets.length).toBeGreaterThan(0);
  });
});
