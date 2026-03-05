import { invoke } from '@tauri-apps/api/core';
import type { PluginManifest, PluginPermission, PluginType, PluginCategory } from './types/manifest';
import type { QcutPlugin } from './types/plugin';
import { WasmPluginWrapper } from './wasm-wrapper';

const VALID_PERMISSIONS: PluginPermission[] = [
  'timeline:read', 'timeline:write',
  'preview:read', 'preview:write',
  'file:read', 'file:write',
  'settings:read', 'settings:write',
  'ui:panel', 'ui:toolbar',
  'frame:process',
];

const VALID_TYPES: PluginType[] = ['typescript', 'wasm', 'hybrid'];
const VALID_CATEGORIES: PluginCategory[] = ['effect', 'filter', 'export', 'import', 'ui', 'tool'];

export class PluginLoader {
  async discoverPlugins(): Promise<{ manifest: PluginManifest; dir: string }[]> {
    const dirs = await invoke<string[]>('list_plugin_dirs');
    const results: { manifest: PluginManifest; dir: string }[] = [];

    for (const dir of dirs) {
      try {
        const raw = await invoke<string>('read_plugin_manifest', { pluginDir: dir });
        const parsed: unknown = JSON.parse(raw);
        const manifest = this.validateManifest(parsed);
        if (manifest) {
          results.push({ manifest, dir });
        }
      } catch (e) {
        console.warn(`[PluginLoader] ${dir} のマニフェスト読み込みに失敗:`, e);
      }
    }

    return results;
  }

  async loadTypeScriptPlugin(manifest: PluginManifest, pluginDir: string): Promise<QcutPlugin> {
    if (!manifest.entry.js) {
      throw new Error(`[${manifest.id}] TypeScript エントリポイントが未指定`);
    }

    const filePath = `${pluginDir}/${manifest.entry.js}`;
    const bytes = await invoke<number[]>('read_plugin_file', { filePath });
    const source = new TextDecoder().decode(new Uint8Array(bytes));
    const blob = new Blob([source], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);

    try {
      const module = await import(/* @vite-ignore */ url);
      const plugin: QcutPlugin = module.default;

      if (!plugin || typeof plugin.onInit !== 'function') {
        throw new Error(`[${manifest.id}] default export が QcutPlugin インターフェースを満たしていません`);
      }

      return plugin;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async loadWasmPlugin(manifest: PluginManifest, pluginDir: string): Promise<WasmPluginWrapper> {
    if (!manifest.entry.wasm) {
      throw new Error(`[${manifest.id}] WASM エントリポイントが未指定`);
    }

    const filePath = `${pluginDir}/${manifest.entry.wasm}`;
    const bytes = await invoke<number[]>('read_plugin_file', { filePath });
    const buffer = new Uint8Array(bytes).buffer;

    return new WasmPluginWrapper(buffer, manifest);
  }

  async loadPlugin(manifest: PluginManifest, pluginDir: string): Promise<QcutPlugin> {
    switch (manifest.type) {
      case 'typescript':
        return this.loadTypeScriptPlugin(manifest, pluginDir);
      case 'wasm':
        return this.loadWasmPlugin(manifest, pluginDir);
      case 'hybrid': {
        const tsPlugin = await this.loadTypeScriptPlugin(manifest, pluginDir);
        const wasmWrapper = await this.loadWasmPlugin(manifest, pluginDir);
        // hybrid: TS プラグインが UI/ライフサイクルを担当し、WASM は processFrame として利用可能
        (tsPlugin as QcutPlugin & { wasmProcessor?: WasmPluginWrapper }).wasmProcessor = wasmWrapper;
        return tsPlugin;
      }
      default:
        throw new Error(`[${manifest.id}] 未知のプラグインタイプ: ${manifest.type}`);
    }
  }

  validateManifest(raw: unknown): PluginManifest | null {
    if (!raw || typeof raw !== 'object') return null;

    const obj = raw as Record<string, unknown>;

    // 必須フィールドのチェック
    if (typeof obj.id !== 'string' || !obj.id) return null;
    if (typeof obj.name !== 'string' || !obj.name) return null;
    if (typeof obj.version !== 'string') return null;
    if (typeof obj.description !== 'string') return null;
    if (typeof obj.author !== 'string') return null;
    if (typeof obj.minAppVersion !== 'string') return null;

    if (!VALID_TYPES.includes(obj.type as PluginType)) return null;
    if (!VALID_CATEGORIES.includes(obj.category as PluginCategory)) return null;

    // entry の検証
    if (!obj.entry || typeof obj.entry !== 'object') return null;
    const entry = obj.entry as Record<string, unknown>;
    if (obj.type === 'typescript' && typeof entry.js !== 'string') return null;
    if (obj.type === 'wasm' && typeof entry.wasm !== 'string') return null;
    if (obj.type === 'hybrid') {
      if (typeof entry.js !== 'string' || typeof entry.wasm !== 'string') return null;
    }

    // permissions の検証
    if (!Array.isArray(obj.permissions)) return null;
    const permissions = obj.permissions as string[];
    if (!permissions.every((p) => VALID_PERMISSIONS.includes(p as PluginPermission))) return null;

    return {
      id: obj.id as string,
      name: obj.name as string,
      version: obj.version as string,
      description: obj.description as string,
      author: obj.author as string,
      type: obj.type as PluginType,
      entry: {
        js: typeof entry.js === 'string' ? entry.js : undefined,
        wasm: typeof entry.wasm === 'string' ? entry.wasm : undefined,
      },
      permissions: permissions as PluginPermission[],
      minAppVersion: obj.minAppVersion as string,
      category: obj.category as PluginCategory,
      settingsSchema: typeof obj.settingsSchema === 'object' ? obj.settingsSchema as Record<string, unknown> : undefined,
    };
  }
}
