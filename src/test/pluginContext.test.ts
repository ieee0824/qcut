import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginContextImpl, PluginPermissionError } from '../plugin-system/context';
import type { PluginManifest } from '../plugin-system/types/manifest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@/store/actionLogger', () => ({
  logAction: vi.fn(),
}));

vi.mock('@/store/timelineStore', () => ({
  useTimelineStore: {
    getState: vi.fn(() => ({
      tracks: [],
      currentTime: 0,
      addClip: vi.fn(),
      updateClip: vi.fn(),
      removeClip: vi.fn(),
    })),
    subscribe: vi.fn(() => vi.fn()),
  },
}));

const mockAddPanel = vi.fn();
const mockRemovePanel = vi.fn();
const mockAddToolbarButton = vi.fn();
const mockRemoveToolbarButton = vi.fn();
const mockAddNotification = vi.fn();
const mockRemoveNotification = vi.fn();

vi.mock('@/store/pluginStore', () => ({
  usePluginStore: {
    getState: vi.fn(() => ({
      addPanel: mockAddPanel,
      removePanel: mockRemovePanel,
      addToolbarButton: mockAddToolbarButton,
      removeToolbarButton: mockRemoveToolbarButton,
      addNotification: mockAddNotification,
      removeNotification: mockRemoveNotification,
    })),
  },
}));

const mockRegisterCustomFormat = vi.fn();
const mockUnregisterCustomFormat = vi.fn();

vi.mock('@/store/exportStore', () => ({
  useExportStore: {
    getState: vi.fn(() => ({
      registerCustomFormat: mockRegisterCustomFormat,
      unregisterCustomFormat: mockUnregisterCustomFormat,
    })),
  },
}));

const baseManifest: PluginManifest = {
  id: 'com.test.plugin',
  name: 'Test Plugin',
  version: '1.0.0',
  description: 'A test plugin',
  author: 'test',
  type: 'typescript',
  entry: { js: 'index.js' },
  permissions: [],
  minAppVersion: '0.2.0',
  category: 'tool',
};

const sampleProfile = {
  key: 'hevc',
  label: 'H.265/HEVC (MP4)',
  ext: 'mp4',
  filterName: 'MP4',
  videoCodec: 'libx265',
  audioCodec: 'aac',
  audioBitrate: '128k',
};

describe('PluginContextImpl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('export.registerFormat()', () => {
    it('export:write 権限ありなら登録が成功する', () => {
      const manifest = { ...baseManifest, permissions: ['export:write'] as PluginManifest['permissions'] };
      const ctx = new PluginContextImpl('com.test.plugin', manifest);

      expect(() => ctx.export.registerFormat(sampleProfile)).not.toThrow();
      expect(mockRegisterCustomFormat).toHaveBeenCalledWith(sampleProfile);
    });

    it('export:write 権限なしで呼ぶと PluginPermissionError がスローされる', () => {
      const manifest = { ...baseManifest, permissions: [] as PluginManifest['permissions'] };
      const ctx = new PluginContextImpl('com.test.plugin', manifest);

      expect(() => ctx.export.registerFormat(sampleProfile)).toThrow(PluginPermissionError);
    });

    it('エラーメッセージに pluginId と権限名が含まれる', () => {
      const manifest = { ...baseManifest, permissions: [] as PluginManifest['permissions'] };
      const ctx = new PluginContextImpl('com.test.plugin', manifest);

      let error: unknown;
      try {
        ctx.export.registerFormat(sampleProfile);
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(PluginPermissionError);
      expect((error as Error).message).toContain('com.test.plugin');
      expect((error as Error).message).toContain('export:write');
    });

    it('ui:panel だけで export:write なしなら PluginPermissionError', () => {
      const manifest = { ...baseManifest, permissions: ['ui:panel'] as PluginManifest['permissions'] };
      const ctx = new PluginContextImpl('com.test.plugin', manifest);

      expect(() => ctx.export.registerFormat(sampleProfile)).toThrow(PluginPermissionError);
    });

    it('同じキーを2回登録しても registerCustomFormat は1回しか呼ばれない', () => {
      const manifest = { ...baseManifest, permissions: ['export:write'] as PluginManifest['permissions'] };
      const ctx = new PluginContextImpl('com.test.plugin', manifest);

      ctx.export.registerFormat(sampleProfile);
      ctx.export.registerFormat(sampleProfile);

      expect(mockRegisterCustomFormat).toHaveBeenCalledTimes(1);
    });

    it('Disposable.dispose() を呼ぶと unregisterCustomFormat が実行される', () => {
      const manifest = { ...baseManifest, permissions: ['export:write'] as PluginManifest['permissions'] };
      const ctx = new PluginContextImpl('com.test.plugin', manifest);

      const disposable = ctx.export.registerFormat(sampleProfile);
      disposable.dispose();

      expect(mockUnregisterCustomFormat).toHaveBeenCalledWith('hevc');
    });

    it('disposeAll() で登録済みフォーマットがすべて解除される', () => {
      const manifest = { ...baseManifest, permissions: ['export:write'] as PluginManifest['permissions'] };
      const ctx = new PluginContextImpl('com.test.plugin', manifest);

      ctx.export.registerFormat(sampleProfile);
      ctx.export.registerFormat({ ...sampleProfile, key: 'av1' });
      ctx.disposeAll();

      expect(mockUnregisterCustomFormat).toHaveBeenCalledTimes(2);
    });
  });
});
