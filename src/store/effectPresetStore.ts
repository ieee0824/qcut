import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { EffectPreset } from '../data/effectPresets';
import { BUILT_IN_EFFECT_PRESETS } from '../data/effectPresets';
import type { ClipEffects } from './timelineStore';

interface EffectPresetState {
  customPresets: EffectPreset[];
  loaded: boolean;
  loadPresets: () => Promise<void>;
  addPreset: (name: string, effects: Partial<ClipEffects>) => Promise<void>;
  removePreset: (id: string) => Promise<void>;
  getAllPresets: () => EffectPreset[];
}

async function invokeRead(): Promise<string> {
  try {
    return await invoke<string>('read_effect_presets');
  } catch {
    return '[]';
  }
}

async function invokeWrite(content: string): Promise<void> {
  try {
    await invoke('write_effect_presets', { content });
  } catch (error) {
    if (typeof window !== 'undefined' && (window as Record<string, unknown>).__TAURI__) {
      console.error('Failed to write effect presets', error);
    }
  }
}

export const useEffectPresetStore = create<EffectPresetState>((set, get) => ({
  customPresets: [],
  loaded: false,

  loadPresets: async () => {
    const json = await invokeRead();
    try {
      const presets = JSON.parse(json) as EffectPreset[];
      set({ customPresets: presets.map(p => ({ ...p, isBuiltIn: false, category: p.category || 'custom' })), loaded: true });
    } catch {
      set({ customPresets: [], loaded: true });
    }
  },

  addPreset: async (name, effects) => {
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newPreset: EffectPreset = { id, name, category: 'custom', effects, isBuiltIn: false };
    const updated = [...get().customPresets, newPreset];
    set({ customPresets: updated });
    await invokeWrite(JSON.stringify(updated));
  },

  removePreset: async (id) => {
    const updated = get().customPresets.filter(p => p.id !== id);
    set({ customPresets: updated });
    await invokeWrite(JSON.stringify(updated));
  },

  getAllPresets: () => {
    return [...BUILT_IN_EFFECT_PRESETS, ...get().customPresets];
  },
}));
