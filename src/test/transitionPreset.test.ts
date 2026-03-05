import { describe, it, expect, beforeEach } from 'vitest';
import { useTransitionPresetStore, BUILT_IN_PRESETS } from '../store/transitionPresetStore';

describe('transition preset store', () => {
  beforeEach(() => {
    useTransitionPresetStore.setState({
      customPresets: [],
      loaded: false,
    });
  });

  describe('built-in presets', () => {
    it('should have 8 built-in presets', () => {
      expect(BUILT_IN_PRESETS).toHaveLength(8);
    });

    it('should include all transition types in built-in presets', () => {
      const types = BUILT_IN_PRESETS.map(p => p.type);
      expect(types).toContain('crossfade');
      expect(types).toContain('dissolve');
      expect(types).toContain('wipe-left');
      expect(types).toContain('wipe-right');
      expect(types).toContain('wipe-up');
      expect(types).toContain('wipe-down');
    });

    it('should mark all built-in presets as isBuiltIn', () => {
      for (const preset of BUILT_IN_PRESETS) {
        expect(preset.isBuiltIn).toBe(true);
      }
    });

    it('should have valid durations for all built-in presets', () => {
      for (const preset of BUILT_IN_PRESETS) {
        expect(preset.duration).toBeGreaterThan(0);
        expect(preset.duration).toBeLessThanOrEqual(3.0);
      }
    });
  });

  describe('getAllPresets', () => {
    it('should return built-in presets when no custom presets exist', () => {
      const presets = useTransitionPresetStore.getState().getAllPresets();
      expect(presets).toHaveLength(8);
      expect(presets.every(p => p.isBuiltIn)).toBe(true);
    });

    it('should return built-in + custom presets', () => {
      useTransitionPresetStore.setState({
        customPresets: [
          { id: 'custom-1', name: 'My Preset', type: 'crossfade', duration: 1.5, isBuiltIn: false },
        ],
      });
      const presets = useTransitionPresetStore.getState().getAllPresets();
      expect(presets).toHaveLength(9);
      expect(presets[8].name).toBe('My Preset');
      expect(presets[8].isBuiltIn).toBe(false);
    });
  });

  describe('addPreset', () => {
    it('should add a custom preset', async () => {
      await useTransitionPresetStore.getState().addPreset('Test Preset', 'dissolve', 2.0);
      const state = useTransitionPresetStore.getState();
      expect(state.customPresets).toHaveLength(1);
      expect(state.customPresets[0].name).toBe('Test Preset');
      expect(state.customPresets[0].type).toBe('dissolve');
      expect(state.customPresets[0].duration).toBe(2.0);
      expect(state.customPresets[0].isBuiltIn).toBe(false);
      expect(state.customPresets[0].id).toMatch(/^custom-/);
    });

    it('should add multiple custom presets', async () => {
      const { addPreset } = useTransitionPresetStore.getState();
      await addPreset('Preset A', 'crossfade', 0.5);
      await addPreset('Preset B', 'wipe-left', 1.0);
      const state = useTransitionPresetStore.getState();
      expect(state.customPresets).toHaveLength(2);
    });
  });

  describe('removePreset', () => {
    it('should remove a custom preset', async () => {
      await useTransitionPresetStore.getState().addPreset('To Remove', 'crossfade', 1.0);
      const id = useTransitionPresetStore.getState().customPresets[0].id;
      await useTransitionPresetStore.getState().removePreset(id);
      expect(useTransitionPresetStore.getState().customPresets).toHaveLength(0);
    });

    it('should not affect other presets when removing one', async () => {
      const { addPreset } = useTransitionPresetStore.getState();
      await addPreset('Keep', 'crossfade', 1.0);
      await addPreset('Remove', 'dissolve', 2.0);
      const removeId = useTransitionPresetStore.getState().customPresets[1].id;
      await useTransitionPresetStore.getState().removePreset(removeId);
      const remaining = useTransitionPresetStore.getState().customPresets;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].name).toBe('Keep');
    });
  });
});
