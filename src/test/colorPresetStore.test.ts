import { describe, it, expect, beforeEach } from 'vitest';
import { useColorPresetStore } from '../store/colorPresetStore';
import { BUILT_IN_COLOR_PRESETS } from '../data/colorPresets';

describe('colorPresetStore', () => {
  beforeEach(() => {
    useColorPresetStore.setState({
      customPresets: [],
      loaded: false,
    });
  });

  it('should have empty custom presets by default', () => {
    expect(useColorPresetStore.getState().customPresets).toEqual([]);
  });

  it('should not be loaded by default', () => {
    expect(useColorPresetStore.getState().loaded).toBe(false);
  });

  it('should return built-in presets from getAllPresets', () => {
    const all = useColorPresetStore.getState().getAllPresets();
    expect(all.length).toBe(BUILT_IN_COLOR_PRESETS.length);
    expect(all[0].isBuiltIn).toBe(true);
  });

  it('should add a custom preset', async () => {
    await useColorPresetStore.getState().addPreset('My Look', { brightness: 1.2, contrast: 1.1 });
    const customs = useColorPresetStore.getState().customPresets;
    expect(customs.length).toBe(1);
    expect(customs[0].name).toBe('My Look');
    expect(customs[0].category).toBe('custom');
    expect(customs[0].isBuiltIn).toBe(false);
    expect(customs[0].effects.brightness).toBe(1.2);
    expect(customs[0].effects.contrast).toBe(1.1);
  });

  it('should generate unique id for custom preset', async () => {
    await useColorPresetStore.getState().addPreset('A', {});
    await useColorPresetStore.getState().addPreset('B', {});
    const customs = useColorPresetStore.getState().customPresets;
    expect(customs[0].id).not.toBe(customs[1].id);
    expect(customs[0].id.startsWith('custom-')).toBe(true);
  });

  it('should include custom presets in getAllPresets', async () => {
    await useColorPresetStore.getState().addPreset('Custom', { saturation: 0.5 });
    const all = useColorPresetStore.getState().getAllPresets();
    expect(all.length).toBe(BUILT_IN_COLOR_PRESETS.length + 1);
    expect(all[all.length - 1].name).toBe('Custom');
  });

  it('should remove a custom preset', async () => {
    await useColorPresetStore.getState().addPreset('ToDelete', {});
    const id = useColorPresetStore.getState().customPresets[0].id;
    await useColorPresetStore.getState().removePreset(id);
    expect(useColorPresetStore.getState().customPresets.length).toBe(0);
  });

  it('should not remove built-in presets from getAllPresets after removing custom', async () => {
    await useColorPresetStore.getState().addPreset('Temp', {});
    const id = useColorPresetStore.getState().customPresets[0].id;
    await useColorPresetStore.getState().removePreset(id);
    const all = useColorPresetStore.getState().getAllPresets();
    expect(all.length).toBe(BUILT_IN_COLOR_PRESETS.length);
  });
});
