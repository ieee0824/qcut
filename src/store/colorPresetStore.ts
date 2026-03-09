import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { ColorPreset } from '../data/colorPresets';
import { BUILT_IN_COLOR_PRESETS } from '../data/colorPresets';
import type { ColorEffectFields } from '../data/colorPresets';

interface ColorPresetState {
  customPresets: ColorPreset[];
  loaded: boolean;
  loadPresets: () => Promise<void>;
  addPreset: (name: string, effects: Partial<ColorEffectFields>) => Promise<void>;
  removePreset: (id: string) => Promise<void>;
  getAllPresets: () => ColorPreset[];
}

async function invokeRead(): Promise<string> {
  try {
    return await invoke<string>('read_color_presets');
  } catch {
    return '[]';
  }
}

async function invokeWrite(content: string): Promise<void> {
  try {
    await invoke('write_color_presets', { content });
  } catch (error) {
    // Tauri 未起動時（テスト等）は無視、実行時エラーはログ出力
    if (typeof window !== 'undefined' && (window as Record<string, unknown>).__TAURI__) {
      console.error('Failed to write color presets', error);
    }
  }
}

export const useColorPresetStore = create<ColorPresetState>((set, get) => ({
  customPresets: [],
  loaded: false,

  loadPresets: async () => {
    const json = await invokeRead();
    try {
      const presets = JSON.parse(json) as ColorPreset[];
      set({ customPresets: presets.map(p => ({ ...p, isBuiltIn: false, category: p.category || 'custom' })), loaded: true });
    } catch {
      set({ customPresets: [], loaded: true });
    }
  },

  addPreset: async (name, effects) => {
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newPreset: ColorPreset = { id, name, category: 'custom', effects, isBuiltIn: false };
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
    return [...BUILT_IN_COLOR_PRESETS, ...get().customPresets];
  },
}));
