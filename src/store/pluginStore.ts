import { create } from 'zustand';
import type { PluginManifest } from '@/plugin-system/types/manifest';
import type { QcutPlugin } from '@/plugin-system/types/plugin';
import type { PanelConfig, ToolbarButtonConfig } from '@/plugin-system/types/api';

export interface StoredPanelConfig extends PanelConfig {
  pluginId: string;
}

export interface StoredToolbarButtonConfig extends ToolbarButtonConfig {
  pluginId: string;
}

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

export interface PluginNotification {
  id: string;
  pluginId: string;
  message: string;
  type: 'info' | 'warning' | 'error';
  timestamp: number;
}

interface PluginStoreState {
  plugins: Record<string, PluginEntry>;
  panels: StoredPanelConfig[];
  toolbarButtons: StoredToolbarButtonConfig[];
  notifications: PluginNotification[];

  registerPlugin: (manifest: PluginManifest, enabled?: boolean) => void;
  setPluginState: (id: string, state: PluginState, error?: string) => void;
  setPluginInstance: (id: string, instance: QcutPlugin) => void;
  togglePlugin: (id: string, enabled: boolean) => void;
  removePlugin: (id: string) => void;
  addPanel: (config: StoredPanelConfig) => void;
  removePanel: (pluginId: string, id: string) => void;
  addToolbarButton: (config: StoredToolbarButtonConfig) => void;
  removeToolbarButton: (pluginId: string, id: string) => void;
  addNotification: (notification: PluginNotification) => void;
  removeNotification: (id: string) => void;
}

export const usePluginStore = create<PluginStoreState>((set) => ({
  plugins: {},
  panels: [],
  toolbarButtons: [],
  notifications: [],

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

  addPanel: (config) =>
    set((state) => ({
      panels: [...state.panels, config],
    })),

  removePanel: (pluginId, id) =>
    set((state) => ({
      panels: state.panels.filter((p) => !(p.pluginId === pluginId && p.id === id)),
    })),

  addToolbarButton: (config) =>
    set((state) => ({
      toolbarButtons: [...state.toolbarButtons, config],
    })),

  removeToolbarButton: (pluginId, id) =>
    set((state) => ({
      toolbarButtons: state.toolbarButtons.filter((b) => !(b.pluginId === pluginId && b.id === id)),
    })),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [...state.notifications, notification],
    })),

  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}));
