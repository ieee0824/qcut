import { create } from 'zustand';
import type { PluginManifest } from '@/plugin-system/types/manifest';
import type { QcutPlugin } from '@/plugin-system/types/plugin';

export type PluginState =
  | 'installed'
  | 'loaded'
  | 'initialized'
  | 'active'
  | 'inactive'
  | 'error';

export interface PluginEntry {
  manifest: PluginManifest;
  state: PluginState;
  enabled: boolean;
  error?: string;
  instance?: QcutPlugin;
}

interface PluginStoreState {
  plugins: Record<string, PluginEntry>;

  registerPlugin: (manifest: PluginManifest, enabled?: boolean) => void;
  setPluginState: (id: string, state: PluginState, error?: string) => void;
  setPluginInstance: (id: string, instance: QcutPlugin) => void;
  togglePlugin: (id: string, enabled: boolean) => void;
  removePlugin: (id: string) => void;
}

export const usePluginStore = create<PluginStoreState>((set) => ({
  plugins: {},

  registerPlugin: (manifest, enabled = true) =>
    set((state) => ({
      plugins: {
        ...state.plugins,
        [manifest.id]: {
          manifest,
          state: 'installed',
          enabled,
        },
      },
    })),

  setPluginState: (id, pluginState, error) =>
    set((state) => {
      const entry = state.plugins[id];
      if (!entry) return state;
      return {
        plugins: {
          ...state.plugins,
          [id]: {
            ...entry,
            state: pluginState,
            error: error ?? entry.error,
          },
        },
      };
    }),

  setPluginInstance: (id, instance) =>
    set((state) => {
      const entry = state.plugins[id];
      if (!entry) return state;
      return {
        plugins: {
          ...state.plugins,
          [id]: { ...entry, instance },
        },
      };
    }),

  togglePlugin: (id, enabled) =>
    set((state) => {
      const entry = state.plugins[id];
      if (!entry) return state;
      return {
        plugins: {
          ...state.plugins,
          [id]: { ...entry, enabled },
        },
      };
    }),

  removePlugin: (id) =>
    set((state) => {
      const { [id]: _removed, ...rest } = state.plugins;
      void _removed;
      return { plugins: rest };
    }),
}));
