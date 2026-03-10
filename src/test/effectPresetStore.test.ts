import { describe, it, expect, beforeEach, vi } from 'vitest';
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
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000);
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.9);
    await useEffectPresetStore.getState().addPreset('A', {});
    await useEffectPresetStore.getState().addPreset('B', {});
    dateSpy.mockRestore();
    randomSpy.mockRestore();
    const customs = useEffectPresetStore.getState().customPresets;
    expect(customs[0].id).toBe(`custom-1000-${(0.1).toString(36).slice(2, 8)}`);
    expect(customs[1].id).toBe(`custom-2000-${(0.9).toString(36).slice(2, 8)}`);
    expect(customs[0].id).not.toBe(customs[1].id);
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
