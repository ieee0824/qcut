import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginLoader } from '../plugin-system/loader';

// invoke モック
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@/store/actionLogger', () => ({
  logAction: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import { logAction } from '@/store/actionLogger';

const mockedInvoke = vi.mocked(invoke);
const mockedLogAction = vi.mocked(logAction);

describe('PluginLoader', () => {
  let loader: PluginLoader;

  beforeEach(() => {
    loader = new PluginLoader();
    vi.clearAllMocks();
  });

  describe('validateManifest', () => {
    const validManifest = {
      id: 'com.test.plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'A test plugin',
      author: 'test',
      type: 'typescript',
      entry: { js: 'index.js' },
      permissions: ['ui:panel'],
      minAppVersion: '0.1.0',
      category: 'tool',
    };

    it('有効なマニフェストを受け入れる', () => {
      const result = loader.validateManifest(validManifest);
      expect(result).not.toBeNull();
      expect(result!.id).toBe('com.test.plugin');
      expect(result!.name).toBe('Test Plugin');
      expect(result!.type).toBe('typescript');
      expect(result!.category).toBe('tool');
    });

    it('null を返す: null 入力', () => {
      expect(loader.validateManifest(null)).toBeNull();
    });

    it('null を返す: 非オブジェクト', () => {
      expect(loader.validateManifest('string')).toBeNull();
    });

    it('null を返す: id が空', () => {
      expect(loader.validateManifest({ ...validManifest, id: '' })).toBeNull();
    });

    it('null を返す: id が未定義', () => {
      expect(loader.validateManifest({ ...validManifest, id: undefined })).toBeNull();
    });

    it('null を返す: name が未定義', () => {
      expect(loader.validateManifest({ ...validManifest, name: undefined })).toBeNull();
    });

    it('null を返す: 不正な type', () => {
      expect(loader.validateManifest({ ...validManifest, type: 'python' })).toBeNull();
    });

    it('null を返す: 不正な category', () => {
      expect(loader.validateManifest({ ...validManifest, category: 'unknown' })).toBeNull();
    });

    it('null を返す: typescript で js エントリなし', () => {
      expect(loader.validateManifest({ ...validManifest, entry: {} })).toBeNull();
    });

    it('null を返す: wasm で wasm エントリなし', () => {
      expect(loader.validateManifest({ ...validManifest, type: 'wasm', entry: { js: 'index.js' } })).toBeNull();
    });

    it('null を返す: hybrid で js/wasm 両方必要', () => {
      expect(loader.validateManifest({ ...validManifest, type: 'hybrid', entry: { js: 'index.js' } })).toBeNull();
    });

    it('hybrid で両方あれば有効', () => {
      const result = loader.validateManifest({
        ...validManifest,
        type: 'hybrid',
        entry: { js: 'index.js', wasm: 'plugin.wasm' },
      });
      expect(result).not.toBeNull();
      expect(result!.entry.js).toBe('index.js');
      expect(result!.entry.wasm).toBe('plugin.wasm');
    });

    it('null を返す: permissions が配列でない', () => {
      expect(loader.validateManifest({ ...validManifest, permissions: 'ui:panel' })).toBeNull();
    });

    it('null を返す: 不正な permission', () => {
      expect(loader.validateManifest({ ...validManifest, permissions: ['invalid:perm'] })).toBeNull();
    });

    it('null を返す: entry がオブジェクトでない', () => {
      expect(loader.validateManifest({ ...validManifest, entry: 'index.js' })).toBeNull();
    });

    it('settingsSchema を含む', () => {
      const result = loader.validateManifest({
        ...validManifest,
        settingsSchema: { intensity: { type: 'number', default: 1.0 } },
      });
      expect(result).not.toBeNull();
      expect(result!.settingsSchema).toEqual({ intensity: { type: 'number', default: 1.0 } });
    });

    it('settingsSchema が未定義なら undefined', () => {
      const result = loader.validateManifest(validManifest);
      expect(result!.settingsSchema).toBeUndefined();
    });
  });

  describe('discoverPlugins', () => {
    const validManifestJson = JSON.stringify({
      id: 'com.test.plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'A test plugin',
      author: 'test',
      type: 'typescript',
      entry: { js: 'index.js' },
      permissions: ['ui:panel'],
      minAppVersion: '0.1.0',
      category: 'tool',
    });

    it('整合性検証 verified のプラグインをログに記録', async () => {
      mockedInvoke
        .mockResolvedValueOnce(['/plugins/test'])  // list_plugin_dirs
        .mockResolvedValueOnce(validManifestJson)  // read_plugin_manifest
        .mockResolvedValueOnce('verified');         // verify_plugin_integrity

      const results = await loader.discoverPlugins();
      expect(results).toHaveLength(1);
      expect(results[0].manifest.id).toBe('com.test.plugin');
      expect(mockedLogAction).toHaveBeenCalledWith(
        'pluginLoader:integrity:verified',
        expect.stringContaining('com.test.plugin'),
      );
    });

    it('checksums 未定義のプラグインを skip としてログに記録', async () => {
      mockedInvoke
        .mockResolvedValueOnce(['/plugins/test'])
        .mockResolvedValueOnce(validManifestJson)
        .mockResolvedValueOnce('no_checksums');

      const results = await loader.discoverPlugins();
      expect(results).toHaveLength(1);
      expect(mockedLogAction).toHaveBeenCalledWith(
        'pluginLoader:integrity:skip',
        expect.stringContaining('com.test.plugin'),
      );
    });

    it('整合性検証失敗のプラグインを rejected としてログに記録', async () => {
      mockedInvoke
        .mockResolvedValueOnce(['/plugins/broken'])
        .mockResolvedValueOnce(validManifestJson)
        .mockRejectedValueOnce(new Error('checksum mismatch'));

      const results = await loader.discoverPlugins();
      expect(results).toHaveLength(0);
      expect(mockedLogAction).toHaveBeenCalledWith(
        'pluginLoader:integrity:rejected',
        expect.stringContaining('broken'),
      );
    });

    it('マニフェスト読み込み失敗のプラグインを rejected としてログに記録', async () => {
      mockedInvoke
        .mockResolvedValueOnce(['/plugins/bad'])
        .mockRejectedValueOnce(new Error('file not found'));

      const results = await loader.discoverPlugins();
      expect(results).toHaveLength(0);
      expect(mockedLogAction).toHaveBeenCalledWith(
        'pluginLoader:integrity:rejected',
        expect.stringContaining('bad'),
      );
    });

    it('プラグインがない場合は空配列を返す', async () => {
      mockedInvoke.mockResolvedValueOnce([]);

      const results = await loader.discoverPlugins();
      expect(results).toHaveLength(0);
    });
  });
});
