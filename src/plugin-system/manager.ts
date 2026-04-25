import { invoke } from '@tauri-apps/api/core';
import { usePluginStore } from '@/store/pluginStore';
import { logAction } from '@/store/actionLogger';
import { generateId } from '@/utils/idGenerator';
import { PluginLoader } from './loader';
import { PluginContextImpl } from './context';
import { buildPluginNotification, createNotificationAutoRemoveDisposable } from './notifications';
import type { QcutPlugin } from './types/plugin';
import type { PluginManifest } from './types/manifest';

interface ImportPluginResult {
  pluginId: string;
  conflict: boolean;
}

interface PluginSettingsEntry {
  enabled: boolean;
  settings: Record<string, unknown>;
}

type PersistedSettings = Record<string, PluginSettingsEntry>;

export class PluginManager {
  private loader = new PluginLoader();
  private contexts = new Map<string, PluginContextImpl>();
  private pluginDirs = new Map<string, string>();
  private instances = new Map<string, QcutPlugin>();

  async initialize(): Promise<void> {

    const persisted = await this.loadPersistedSettings();
    const discovered = await this.loader.discoverPlugins();
    logAction('pluginManager:init', `discovered ${discovered.length} plugin(s)`);

    const store = usePluginStore.getState();

    for (const { manifest, dir } of discovered) {
      const isEnabled = persisted[manifest.id]?.enabled ?? true;
      store.registerPlugin(manifest, isEnabled);
      this.pluginDirs.set(manifest.id, dir);
      logAction('pluginManager:register', `${manifest.id} (enabled=${isEnabled})`);

      if (isEnabled) {
        await this.activatePlugin(manifest.id);
      }
    }
  }

  async activatePlugin(id: string): Promise<void> {
    const store = usePluginStore.getState();
    const entry = store.plugins[id];
    if (!entry) return;

    const dir = this.pluginDirs.get(id);
    if (!dir) return;

    await this.safeCall(id, async () => {
      // Load
      store.setPluginState(id, 'loaded');
      const instance = await this.loader.loadPlugin(entry.manifest, dir);
      this.instances.set(id, instance);
      store.setPluginInstance(id, instance);

      // Create context
      const context = new PluginContextImpl(id, entry.manifest);
      this.contexts.set(id, context);

      // Restore settings
      const persisted = await this.loadPersistedSettings();
      if (persisted[id]?.settings) {
        context.loadSettings(persisted[id].settings);
      }

      // Initialize
      store.setPluginState(id, 'initialized');
      await instance.onInit(context);

      // Activate
      await instance.onActivate();
      store.setPluginState(id, 'active');
      logAction('pluginManager:activate', id);
    });
  }

  async deactivatePlugin(id: string): Promise<void> {
    const store = usePluginStore.getState();
    const instance = this.instances.get(id);
    const context = this.contexts.get(id);

    if (instance) {
      await this.safeCall(id, async () => {
        await instance.onDeactivate();
      });
    }

    if (context) {
      await this.persistPluginSettings(id, context.getSettings());
      context.disposeAll();
      this.contexts.delete(id);
    }

    this.instances.delete(id);
    store.setPluginState(id, 'inactive');
  }

  async togglePlugin(id: string, enabled: boolean): Promise<void> {
    const store = usePluginStore.getState();
    store.togglePlugin(id, enabled);

    if (enabled) {
      await this.activatePlugin(id);
    } else {
      await this.deactivatePlugin(id);
    }

    await this.persistEnabledState(id, enabled);
  }

  async shutdown(): Promise<void> {
    const ids = [...this.instances.keys()];
    for (const id of ids) {
      const instance = this.instances.get(id);
      const context = this.contexts.get(id);

      if (instance) {
        await this.safeCall(id, async () => {
          await instance.onDeactivate();
          if (instance.onDestroy) {
            await instance.onDestroy();
          }
        });
      }

      if (context) {
        await this.persistPluginSettings(id, context.getSettings());
        context.disposeAll();
      }
    }

    this.instances.clear();
    this.contexts.clear();
  }

  getContext(id: string): PluginContextImpl | undefined {
    return this.contexts.get(id);
  }

  /**
   * プラグインディレクトリをインポートする。
   * conflict=true が返った場合は上書き確認後に force=true で再呼び出しする。
   * インポート成功後は自動的にプラグインを登録・有効化する。
   */
  async importPlugin(srcPath: string, force: boolean): Promise<ImportPluginResult> {
    const result = await invoke<ImportPluginResult>('import_plugin', { srcPath, force });
    if (result.conflict) {
      return result;
    }

    // インポートしたプラグインを発見・登録・有効化する
    const discovered = await this.loader.discoverPlugins();
    const imported = discovered.find((d) => d.manifest.id === result.pluginId);
    if (imported) {
      const id = imported.manifest.id;
      const store = usePluginStore.getState();

      // 上書きインポート時: 旧インスタンスを先に無効化してリソースリークを防ぐ
      if (this.instances.has(id)) {
        await this.deactivatePlugin(id);
      }

      // ストアの manifest を最新版で上書き（enabled=true で再登録）
      store.registerPlugin(imported.manifest, true);

      this.pluginDirs.set(id, imported.dir);
      await this.activatePlugin(id);

      // enabled=true を永続化
      await this.persistEnabledState(id, true);

      logAction('pluginManager:import', id);
    }

    return result;
  }

  /**
   * インストール済みプラグインを削除する（無効化後にファイルを削除）。
   */
  async deletePlugin(id: string): Promise<void> {
    // まず無効化
    if (this.instances.has(id)) {
      await this.deactivatePlugin(id);
    }

    await invoke('delete_plugin', { pluginId: id });

    const store = usePluginStore.getState();
    store.removePlugin(id);
    this.pluginDirs.delete(id);

    // plugin-settings.json からも削除
    const settings = await this.loadPersistedSettings();
    delete settings[id];
    await this.savePersistedSettings(settings);

    logAction('pluginManager:delete', id);
  }

  /** 現在ロード済みのプラグイン一覧を返す（UI 表示用） */
  getPluginManifests(): PluginManifest[] {
    return Object.values(usePluginStore.getState().plugins).map((e) => e.manifest);
  }

  private async safeCall<T>(pluginId: string, fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Plugin ${pluginId}] Error:`, message);
      logAction(`pluginManager:error`, `${pluginId}: ${message}`);

      const store = usePluginStore.getState();
      store.setPluginState(pluginId, 'error', message);

      const displayName = store.plugins[pluginId]?.manifest.name ?? pluginId;
      const notifId = generateId(`plugin-error-${pluginId}`);
      store.addNotification(buildPluginNotification({
        id: notifId,
        pluginId,
        message: `プラグイン "${displayName}" でエラーが発生しました: ${message}`,
        type: 'error',
        timestamp: Date.now(),
      }));
      createNotificationAutoRemoveDisposable(
        notifId,
        (notificationId) => usePluginStore.getState().removeNotification(notificationId),
      );

      const context = this.contexts.get(pluginId);
      if (context) {
        context.disposeAll();
        this.contexts.delete(pluginId);
      }

      this.instances.delete(pluginId);

      return null;
    }
  }

  private async loadPersistedSettings(): Promise<PersistedSettings> {
    try {
      const json = await invoke<string>('read_plugin_settings');
      return JSON.parse(json) as PersistedSettings;
    } catch {
      return {};
    }
  }

  private async persistEnabledState(id: string, enabled: boolean): Promise<void> {
    const settings = await this.loadPersistedSettings();
    if (!settings[id]) {
      settings[id] = { enabled, settings: {} };
    } else {
      settings[id].enabled = enabled;
    }
    await this.savePersistedSettings(settings);
  }

  private async persistPluginSettings(
    id: string,
    pluginSettings: Record<string, unknown>,
  ): Promise<void> {
    const settings = await this.loadPersistedSettings();
    if (!settings[id]) {
      settings[id] = { enabled: true, settings: pluginSettings };
    } else {
      settings[id].settings = pluginSettings;
    }
    await this.savePersistedSettings(settings);
  }

  private async savePersistedSettings(settings: PersistedSettings): Promise<void> {
    try {
      await invoke('write_plugin_settings', {
        content: JSON.stringify(settings, null, 2),
      });
    } catch (e) {
      console.warn('[PluginManager] 設定の保存に失敗:', e);
    }
  }
}
