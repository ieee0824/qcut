import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { generateId } from '../utils/idGenerator';
import type { EffectPreset, EffectPresetCategory } from '../data/effectPresets';
import { BUILT_IN_EFFECT_PRESETS } from '../data/effectPresets';
import type { ClipEffects } from './timelineStore';

const VALID_CATEGORIES: EffectPresetCategory[] = ['voice', 'music', 'scene', 'custom'];

export function normalizePreset(p: unknown): EffectPreset | null {
  if (!p || typeof p !== 'object') return null;
  const obj = p as Record<string, unknown>;
  const id = typeof obj.id === 'string' && obj.id ? obj.id : null;
  const name = typeof obj.name === 'string' ? obj.name : '';
  if (!id) return null;
  const category: EffectPresetCategory = VALID_CATEGORIES.includes(obj.category as EffectPresetCategory)
    ? (obj.category as EffectPresetCategory)
    : 'custom';
  const effects = obj.effects && typeof obj.effects === 'object' && !Array.isArray(obj.effects)
    ? (obj.effects as Partial<ClipEffects>)
    : {};
  return { id, name, category, effects, isBuiltIn: false };
}

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
      const parsed = JSON.parse(json);
      const presets = Array.isArray(parsed)
        ? parsed.map(normalizePreset).filter((p): p is EffectPreset => p !== null)
        : [];
      set({ customPresets: presets, loaded: true });
    } catch {
      set({ customPresets: [], loaded: true });
    }
  },

  addPreset: async (name, effects) => {
    const id = generateId('custom');
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
