import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { TransitionType } from './timelineStore';

export interface TransitionPreset {
  id: string;
  name: string;
  type: TransitionType;
  duration: number;
  isBuiltIn: boolean;
}

const BUILT_IN_PRESETS: TransitionPreset[] = [
  { id: 'builtin-quick-fade', name: 'preset.quickFade', type: 'crossfade', duration: 0.3, isBuiltIn: true },
  { id: 'builtin-standard-crossfade', name: 'preset.standardCrossfade', type: 'crossfade', duration: 1.0, isBuiltIn: true },
  { id: 'builtin-long-crossfade', name: 'preset.longCrossfade', type: 'crossfade', duration: 2.0, isBuiltIn: true },
  { id: 'builtin-dissolve', name: 'preset.dissolve', type: 'dissolve', duration: 1.0, isBuiltIn: true },
  { id: 'builtin-wipe-left', name: 'preset.wipeLeft', type: 'wipe-left', duration: 0.5, isBuiltIn: true },
  { id: 'builtin-wipe-right', name: 'preset.wipeRight', type: 'wipe-right', duration: 0.5, isBuiltIn: true },
  { id: 'builtin-wipe-up', name: 'preset.wipeUp', type: 'wipe-up', duration: 0.5, isBuiltIn: true },
  { id: 'builtin-wipe-down', name: 'preset.wipeDown', type: 'wipe-down', duration: 0.5, isBuiltIn: true },
];

interface TransitionPresetState {
  customPresets: TransitionPreset[];
  loaded: boolean;
  loadPresets: () => Promise<void>;
  addPreset: (name: string, type: TransitionType, duration: number) => Promise<void>;
  removePreset: (id: string) => Promise<void>;
  getAllPresets: () => TransitionPreset[];
}

async function invokeRead(): Promise<string> {
  try {
    return await invoke<string>('read_transition_presets');
  } catch {
    return '[]';
  }
}

async function invokeWrite(content: string): Promise<void> {
  try {
    await invoke('write_transition_presets', { content });
  } catch {
    // Tauri 未起動時（テスト等）は無視
  }
}

export const useTransitionPresetStore = create<TransitionPresetState>((set, get) => ({
  customPresets: [],
  loaded: false,

  loadPresets: async () => {
    const json = await invokeRead();
    try {
      const presets = JSON.parse(json) as TransitionPreset[];
      set({ customPresets: presets.map(p => ({ ...p, isBuiltIn: false })), loaded: true });
    } catch {
      set({ customPresets: [], loaded: true });
    }
  },

  addPreset: async (name, type, duration) => {
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newPreset: TransitionPreset = { id, name, type, duration, isBuiltIn: false };
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
    return [...BUILT_IN_PRESETS, ...get().customPresets];
  },
}));

export { BUILT_IN_PRESETS };
