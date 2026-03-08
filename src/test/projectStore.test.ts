import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
  open: vi.fn(),
  ask: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import { save, open, ask } from '@tauri-apps/plugin-dialog';
import { useProjectStore } from '../store/projectStore';
import { useTimelineStore } from '../store/timelineStore';
import { useExportStore } from '../store/exportStore';
import { useVideoPreviewStore } from '../store/videoPreviewStore';
import type { ProjectFile } from '../types/projectFile';

describe('projectStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset stores
    useProjectStore.setState({
      projectFilePath: null,
      projectName: '無題のプロジェクト',
      isDirty: false,
      saveStatus: 'idle',
      saveError: null,
      loadStatus: 'idle',
      loadError: null,
      missingFiles: [],
    });
  });

  it('初期状態が正しい', () => {
    const state = useProjectStore.getState();
    expect(state.projectFilePath).toBeNull();
    expect(state.projectName).toBe('無題のプロジェクト');
    expect(state.isDirty).toBe(false);
    expect(state.saveStatus).toBe('idle');
  });

  it('markDirty で isDirty が true になる', () => {
    useProjectStore.getState().markDirty();
    expect(useProjectStore.getState().isDirty).toBe(true);
  });

  it('markClean で isDirty が false, saveStatus が saved になる', () => {
    useProjectStore.getState().markDirty();
    useProjectStore.getState().markClean();
    expect(useProjectStore.getState().isDirty).toBe(false);
    expect(useProjectStore.getState().saveStatus).toBe('saved');
  });

  it('saveProject はパスが未設定の場合 saveProjectAs にフォールバックする', async () => {
    vi.mocked(save).mockResolvedValue(null);
    await useProjectStore.getState().saveProject();
    expect(save).toHaveBeenCalled();
  });

  it('saveProject はパスが設定済みの場合そのまま保存する', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    useProjectStore.setState({ projectFilePath: '/tmp/test.qcut' });

    await useProjectStore.getState().saveProject();

    expect(invoke).toHaveBeenCalledWith('save_project', {
      path: '/tmp/test.qcut',
      content: expect.any(String),
    });
    expect(useProjectStore.getState().isDirty).toBe(false);
    expect(useProjectStore.getState().saveStatus).toBe('saved');
  });

  it('saveProject の content に正しいスキーマバージョンが含まれる', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    useProjectStore.setState({ projectFilePath: '/tmp/test.qcut' });

    await useProjectStore.getState().saveProject();

    const call = vi.mocked(invoke).mock.calls[0];
    const args = call[1] as { content: string };
    const parsed = JSON.parse(args.content);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.appVersion).toBe('0.1.0');
    expect(parsed.metadata.name).toBe('無題のプロジェクト');
    expect(parsed.timeline).toBeDefined();
    expect(parsed.exportSettings).toBeDefined();
  });

  it('saveProject がタイムラインのトラックデータを含む', async () => {
    // タイムラインにトラックを追加
    useTimelineStore.getState().addTrack({
      id: 'video-1',
      type: 'video',
      name: 'Video 1',
      clips: [],
    });

    vi.mocked(invoke).mockResolvedValue(undefined);
    useProjectStore.setState({ projectFilePath: '/tmp/test.qcut' });

    await useProjectStore.getState().saveProject();

    const saveCalls = vi.mocked(invoke).mock.calls.filter(
      (c) => c[0] === 'save_project'
    );
    expect(saveCalls).toHaveLength(1);
    const args = saveCalls[0][1] as { content: string };
    const parsed = JSON.parse(args.content);
    const videoTrack = parsed.timeline.tracks.find((t: { id: string }) => t.id === 'video-1');
    expect(videoTrack).toBeDefined();
    expect(videoTrack.type).toBe('video');
  });

  it('saveProject がエクスポート設定を含む', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    useProjectStore.setState({ projectFilePath: '/tmp/test.qcut' });
    useExportStore.getState().setSettings({ fps: 60 });

    await useProjectStore.getState().saveProject();

    const call = vi.mocked(invoke).mock.calls[0];
    const args = call[1] as { content: string };
    const parsed = JSON.parse(args.content);
    expect(parsed.exportSettings.fps).toBe(60);
  });

  it('saveProjectAs でダイアログキャンセル時は保存しない', async () => {
    vi.mocked(save).mockResolvedValue(null);

    await useProjectStore.getState().saveProjectAs();

    expect(invoke).not.toHaveBeenCalled();
  });

  it('saveProjectAs でファイルパスが選択された場合に保存する', async () => {
    vi.mocked(save).mockResolvedValue('/tmp/my-project.qcut');
    vi.mocked(invoke).mockResolvedValue(undefined);

    await useProjectStore.getState().saveProjectAs();

    expect(invoke).toHaveBeenCalledWith('save_project', {
      path: '/tmp/my-project.qcut',
      content: expect.any(String),
    });
    expect(useProjectStore.getState().projectFilePath).toBe('/tmp/my-project.qcut');
    expect(useProjectStore.getState().projectName).toBe('my-project');
  });

  it('saveProject 失敗時にエラー状態になる', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('書き込みエラー'));
    useProjectStore.setState({ projectFilePath: '/tmp/test.qcut' });

    await useProjectStore.getState().saveProject();

    expect(useProjectStore.getState().saveStatus).toBe('error');
    expect(useProjectStore.getState().saveError).toBe('書き込みエラー');
  });

  // --- loadProject ---

  const validProjectJson: ProjectFile = {
    schemaVersion: 1,
    appVersion: '0.1.0',
    createdAt: '2026-03-08T12:00:00.000Z',
    updatedAt: '2026-03-08T12:00:00.000Z',
    metadata: { name: 'テストプロジェクト' },
    timeline: {
      tracks: [
        {
          id: 'video-1',
          type: 'video',
          name: 'Video 1',
          volume: 1.0,
          mute: false,
          solo: false,
          clips: [
            {
              id: 'clip-1',
              name: 'sample.mp4',
              startTime: 0,
              duration: 10,
              filePath: '/videos/sample.mp4',
              sourceStartTime: 0,
              sourceEndTime: 10,
            },
          ],
        },
      ],
    },
    exportSettings: { format: 'mp4', width: 1920, height: 1080, bitrate: '8M', fps: 30 },
  };

  it('loadProjectFromPath でタイムラインが復元される', async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'read_project') return JSON.stringify(validProjectJson);
      if (cmd === 'get_file_info') return { name: 'sample.mp4', path: '/videos/sample.mp4', size: 1000, last_modified: 0 };
      return undefined;
    });

    await useProjectStore.getState().loadProjectFromPath('/tmp/test.qcut');

    const state = useProjectStore.getState();
    expect(state.projectFilePath).toBe('/tmp/test.qcut');
    expect(state.projectName).toBe('test');
    expect(state.isDirty).toBe(false);
    expect(state.loadStatus).toBe('loaded');
    expect(state.missingFiles).toHaveLength(0);

    const timeline = useTimelineStore.getState();
    expect(timeline.tracks).toHaveLength(1);
    expect(timeline.tracks[0].id).toBe('video-1');
    expect(timeline.tracks[0].clips).toHaveLength(1);
    expect(timeline.tracks[0].clips[0].name).toBe('sample.mp4');
  });

  it('loadProjectFromPath で動画URLがvideoPreviewStoreに登録される', async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'read_project') return JSON.stringify(validProjectJson);
      if (cmd === 'get_file_info') return { name: 'sample.mp4', path: '/videos/sample.mp4', size: 1000, last_modified: 0 };
      return undefined;
    });

    await useProjectStore.getState().loadProjectFromPath('/tmp/test.qcut');

    const videoUrls = useVideoPreviewStore.getState().videoUrls;
    expect(videoUrls['/videos/sample.mp4']).toBe('asset://localhost//videos/sample.mp4');
  });

  it('loadProjectFromPath でエクスポート設定が復元される', async () => {
    const projectWithFps60 = { ...validProjectJson, exportSettings: { ...validProjectJson.exportSettings, fps: 60 } };
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'read_project') return JSON.stringify(projectWithFps60);
      if (cmd === 'get_file_info') return { name: 'sample.mp4', path: '/videos/sample.mp4', size: 1000, last_modified: 0 };
      return undefined;
    });

    await useProjectStore.getState().loadProjectFromPath('/tmp/test.qcut');

    expect(useExportStore.getState().settings.fps).toBe(60);
  });

  it('loadProjectFromPath で素材ファイルが見つからない場合 missingFiles に記録される', async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'read_project') return JSON.stringify(validProjectJson);
      if (cmd === 'get_file_info') throw new Error('ファイルが見つかりません');
      return undefined;
    });

    await useProjectStore.getState().loadProjectFromPath('/tmp/test.qcut');

    expect(useProjectStore.getState().missingFiles).toEqual(['/videos/sample.mp4']);
    // タイムラインは読み込み済み
    expect(useTimelineStore.getState().tracks).toHaveLength(1);
  });

  it('loadProjectFromPath で不正な JSON の場合エラーになる', async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'read_project') return 'invalid json';
      return undefined;
    });

    await useProjectStore.getState().loadProjectFromPath('/tmp/bad.qcut');

    expect(useProjectStore.getState().loadStatus).toBe('error');
    expect(useProjectStore.getState().loadError).toBeDefined();
  });

  it('loadProjectFromPath で未来のスキーマバージョンはエラーになる', async () => {
    const futureProject = { ...validProjectJson, schemaVersion: 999 };
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'read_project') return JSON.stringify(futureProject);
      return undefined;
    });

    await useProjectStore.getState().loadProjectFromPath('/tmp/future.qcut');

    expect(useProjectStore.getState().loadStatus).toBe('error');
    expect(useProjectStore.getState().loadError).toContain('新しいバージョン');
  });

  it('openProject で未保存変更がある場合に警告ダイアログを表示する', async () => {
    useProjectStore.getState().markDirty();
    vi.mocked(ask).mockResolvedValue(false);

    await useProjectStore.getState().openProject();

    expect(ask).toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('openProject で未保存変更があっても続行を選択すれば開く', async () => {
    useProjectStore.getState().markDirty();
    vi.mocked(ask).mockResolvedValue(true);
    vi.mocked(open).mockResolvedValue('/tmp/test.qcut');
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'read_project') return JSON.stringify(validProjectJson);
      if (cmd === 'get_file_info') return { name: 'sample.mp4', path: '/videos/sample.mp4', size: 1000, last_modified: 0 };
      return undefined;
    });

    await useProjectStore.getState().openProject();

    expect(ask).toHaveBeenCalled();
    expect(useProjectStore.getState().projectFilePath).toBe('/tmp/test.qcut');
  });

  it('openProject で未保存変更がない場合は警告なしで開く', async () => {
    vi.mocked(open).mockResolvedValue(null);

    await useProjectStore.getState().openProject();

    expect(ask).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalled();
  });

  it('openProject でダイアログキャンセル時は読み込まない', async () => {
    vi.mocked(open).mockResolvedValue(null);

    await useProjectStore.getState().openProject();

    expect(invoke).not.toHaveBeenCalledWith('read_project', expect.anything());
  });

  it('openProject でファイル選択時に読み込む', async () => {
    vi.mocked(open).mockResolvedValue('/tmp/test.qcut');
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'read_project') return JSON.stringify(validProjectJson);
      if (cmd === 'get_file_info') return { name: 'sample.mp4', path: '/videos/sample.mp4', size: 1000, last_modified: 0 };
      return undefined;
    });

    await useProjectStore.getState().openProject();

    expect(useProjectStore.getState().projectFilePath).toBe('/tmp/test.qcut');
    expect(useTimelineStore.getState().tracks).toHaveLength(1);
  });
});
