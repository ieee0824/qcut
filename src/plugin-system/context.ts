import { useTimelineStore } from '@/store/timelineStore';
import type { Clip } from '@/store/timelineStore';
import { logAction } from '@/store/actionLogger';
import { usePluginStore } from '@/store/pluginStore';
import type { PluginManifest, PluginPermission } from './types/manifest';
import type {
  PluginContext,
  PluginTimelineApi,
  PluginPreviewApi,
  PluginUiApi,
  PluginSettingsApi,
  PluginLogApi,
  Disposable,
  ClipChangeEvent,
  PanelConfig,
  ToolbarButtonConfig,
} from './types/api';

export class PluginPermissionError extends Error {
  constructor(pluginId: string, permission: PluginPermission) {
    super(`[${pluginId}] 権限 "${permission}" が許可されていません`);
    this.name = 'PluginPermissionError';
  }
}

export class PluginContextImpl implements PluginContext {
  private permissions: Set<PluginPermission>;
  private disposables: Disposable[] = [];
  private pluginSettings: Record<string, unknown> = {};
  private settingsListeners: Map<string, Set<(value: unknown) => void>> = new Map();

  // 外部から登録されたパネル・ボタン・フレームコールバックを取得するための公開プロパティ
  readonly registeredPanels: PanelConfig[] = [];
  readonly registeredToolbarButtons: ToolbarButtonConfig[] = [];
  readonly frameRenderCallbacks: Array<(frame: ImageData) => ImageData> = [];

  constructor(
    public readonly pluginId: string,
    public readonly manifest: Readonly<PluginManifest>,
  ) {
    this.permissions = new Set(manifest.permissions);
  }

  get timeline(): PluginTimelineApi {
    return {
      getTracks: () => {
        this.requirePermission('timeline:read');
        return useTimelineStore.getState().tracks;
      },

      getClipById: (clipId: string): Clip | null => {
        this.requirePermission('timeline:read');
        const { tracks } = useTimelineStore.getState();
        for (const track of tracks) {
          const clip = track.clips.find((c) => c.id === clipId);
          if (clip) return clip;
        }
        return null;
      },

      getCurrentTime: () => {
        this.requirePermission('timeline:read');
        return useTimelineStore.getState().currentTime;
      },

      onTimeChange: (callback: (time: number) => void): Disposable => {
        this.requirePermission('timeline:read');
        let prevTime = useTimelineStore.getState().currentTime;
        const unsub = useTimelineStore.subscribe((state) => {
          if (state.currentTime !== prevTime) {
            prevTime = state.currentTime;
            callback(state.currentTime);
          }
        });
        const disposable = { dispose: unsub };
        this.disposables.push(disposable);
        return disposable;
      },

      onClipChange: (callback: (event: ClipChangeEvent) => void): Disposable => {
        this.requirePermission('timeline:read');
        let prevTracks = useTimelineStore.getState().tracks;
        const unsub = useTimelineStore.subscribe((state) => {
          if (state.tracks !== prevTracks) {
            // 簡易的な変更検出（トラック参照が変わった場合に通知）
            for (const track of state.tracks) {
              const prevTrack = prevTracks.find((t) => t.id === track.id);
              if (!prevTrack) continue;
              for (const clip of track.clips) {
                if (!prevTrack.clips.find((c) => c.id === clip.id)) {
                  callback({ type: 'added', trackId: track.id, clipId: clip.id, clip });
                }
              }
              for (const prevClip of prevTrack.clips) {
                if (!track.clips.find((c) => c.id === prevClip.id)) {
                  callback({ type: 'removed', trackId: track.id, clipId: prevClip.id });
                }
              }
            }
            prevTracks = state.tracks;
          }
        });
        const disposable = { dispose: unsub };
        this.disposables.push(disposable);
        return disposable;
      },

      addClip: (trackId: string, clip: Omit<Clip, 'id'>): string => {
        this.requirePermission('timeline:write');
        const id = `plugin-clip-${Date.now()}`;
        useTimelineStore.getState().addClip(trackId, { ...clip, id });
        return id;
      },

      updateClip: (trackId: string, clipId: string, updates: Partial<Clip>) => {
        this.requirePermission('timeline:write');
        useTimelineStore.getState().updateClip(trackId, clipId, updates);
      },

      removeClip: (trackId: string, clipId: string) => {
        this.requirePermission('timeline:write');
        useTimelineStore.getState().removeClip(trackId, clipId);
      },
    };
  }

  get preview(): PluginPreviewApi {
    return {
      getCurrentFrameData: (): ImageData | null => {
        this.requirePermission('preview:read');
        // フレームデータの取得は VideoPreview との統合時に実装
        return null;
      },

      onFrameRender: (callback: (frame: ImageData) => ImageData): Disposable => {
        this.requirePermission('frame:process');
        this.frameRenderCallbacks.push(callback);
        const disposable = {
          dispose: () => {
            const idx = this.frameRenderCallbacks.indexOf(callback);
            if (idx >= 0) this.frameRenderCallbacks.splice(idx, 1);
          },
        };
        this.disposables.push(disposable);
        return disposable;
      },
    };
  }

  get ui(): PluginUiApi {
    return {
      registerPanel: (config: PanelConfig): Disposable => {
        this.requirePermission('ui:panel');
        this.registeredPanels.push(config);
        usePluginStore.getState().addPanel({ ...config, pluginId: this.pluginId });
        const disposable = {
          dispose: () => {
            const idx = this.registeredPanels.indexOf(config);
            if (idx >= 0) this.registeredPanels.splice(idx, 1);
            usePluginStore.getState().removePanel(this.pluginId, config.id);
          },
        };
        this.disposables.push(disposable);
        return disposable;
      },

      registerToolbarButton: (config: ToolbarButtonConfig): Disposable => {
        this.requirePermission('ui:toolbar');
        this.registeredToolbarButtons.push(config);
        usePluginStore.getState().addToolbarButton({ ...config, pluginId: this.pluginId });
        const disposable = {
          dispose: () => {
            const idx = this.registeredToolbarButtons.indexOf(config);
            if (idx >= 0) this.registeredToolbarButtons.splice(idx, 1);
            usePluginStore.getState().removeToolbarButton(this.pluginId, config.id);
          },
        };
        this.disposables.push(disposable);
        return disposable;
      },

      showNotification: (message: string, type: 'info' | 'warning' | 'error') => {
        const store = usePluginStore.getState();
        const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        store.addNotification({
          id,
          pluginId: this.pluginId,
          message,
          type,
          timestamp: Date.now(),
        });
        // 5秒後に自動削除。プラグインのライフサイクルに紐づけるため Disposable として登録
        const timeoutId = setTimeout(() => {
          usePluginStore.getState().removeNotification(id);
        }, 5000);
        const disposable: Disposable = {
          dispose: () => {
            clearTimeout(timeoutId);
            usePluginStore.getState().removeNotification(id);
          },
        };
        this.disposables.push(disposable);
      },
    };
  }

  get settings(): PluginSettingsApi {
    return {
      get: <T>(key: string, defaultValue: T): T => {
        this.requirePermission('settings:read');
        const val = this.pluginSettings[key];
        return val !== undefined ? (val as T) : defaultValue;
      },

      set: (key: string, value: unknown) => {
        this.requirePermission('settings:write');
        this.pluginSettings[key] = value;
        const listeners = this.settingsListeners.get(key);
        if (listeners) {
          listeners.forEach((cb) => cb(value));
        }
      },

      onChange: (key: string, callback: (value: unknown) => void): Disposable => {
        this.requirePermission('settings:read');
        if (!this.settingsListeners.has(key)) {
          this.settingsListeners.set(key, new Set());
        }
        this.settingsListeners.get(key)!.add(callback);
        const disposable = {
          dispose: () => {
            this.settingsListeners.get(key)?.delete(callback);
          },
        };
        this.disposables.push(disposable);
        return disposable;
      },
    };
  }

  get log(): PluginLogApi {
    const prefix = `[Plugin:${this.pluginId}]`;
    return {
      info: (message: string) => {
        console.info(prefix, message);
        logAction(`plugin:${this.pluginId}:info`, message);
      },
      warn: (message: string) => {
        console.warn(prefix, message);
        logAction(`plugin:${this.pluginId}:warn`, message);
      },
      error: (message: string) => {
        console.error(prefix, message);
        logAction(`plugin:${this.pluginId}:error`, message);
      },
    };
  }

  /** プラグイン設定を外部から注入（永続化復元時に使用） */
  loadSettings(settings: Record<string, unknown>): void {
    this.pluginSettings = { ...settings };
  }

  /** 現在の設定を取得（永続化時に使用） */
  getSettings(): Record<string, unknown> {
    return { ...this.pluginSettings };
  }

  /** 全 disposable を解除 */
  disposeAll(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
    this.registeredPanels.length = 0;
    this.registeredToolbarButtons.length = 0;
    this.frameRenderCallbacks.length = 0;
    this.settingsListeners.clear();
  }

  private requirePermission(permission: PluginPermission): void {
    if (!this.permissions.has(permission)) {
      throw new PluginPermissionError(this.pluginId, permission);
    }
  }
}
