import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
  open: vi.fn(),
  ask: vi.fn(),
  message: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import { save, open, ask } from '@tauri-apps/plugin-dialog';
import { useProjectStore, _resetAutosaveState } from '../store/projectStore';
import { useTimelineStore } from '../store/timelineStore';
import { useExportStore } from '../store/exportStore';
import { useVideoPreviewStore } from '../store/videoPreviewStore';
import type { ProjectFile } from '../types/projectFile';

describe('projectStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetAutosaveState();
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
    expect(parsed.schemaVersion).toBe(2);
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
    schemaVersion: 2,
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

  // --- 相対パス変換 ---

  it('saveProject で filePath が相対パスに変換されて保存される', async () => {
    useTimelineStore.setState({
      tracks: [{
        id: 'video-1',
        type: 'video',
        name: 'Video 1',
        volume: 1.0,
        mute: false,
        solo: false,
        clips: [{
          id: 'clip-1',
          name: 'sample.mp4',
          startTime: 0,
          duration: 10,
          filePath: '/Users/test/projects/assets/sample.mp4',
          sourceStartTime: 0,
          sourceEndTime: 10,
        }],
      }],
    });

    vi.mocked(invoke).mockResolvedValue(undefined);
    useProjectStore.setState({ projectFilePath: '/Users/test/projects/myproject.qcut' });

    await useProjectStore.getState().saveProject();

    const saveCall = vi.mocked(invoke).mock.calls.find((c) => c[0] === 'save_project');
    const args = saveCall![1] as { content: string };
    const parsed = JSON.parse(args.content);
    expect(parsed.timeline.tracks[0].clips[0].filePath).toBe('assets/sample.mp4');
  });

  it('saveProject で親ディレクトリの素材は ../ 付きで保存される', async () => {
    useTimelineStore.setState({
      tracks: [{
        id: 'video-1',
        type: 'video',
        name: 'Video 1',
        volume: 1.0,
        mute: false,
        solo: false,
        clips: [{
          id: 'clip-1',
          name: 'sample.mp4',
          startTime: 0,
          duration: 10,
          filePath: '/Users/test/videos/sample.mp4',
          sourceStartTime: 0,
          sourceEndTime: 10,
        }],
      }],
    });

    vi.mocked(invoke).mockResolvedValue(undefined);
    useProjectStore.setState({ projectFilePath: '/Users/test/projects/myproject.qcut' });

    await useProjectStore.getState().saveProject();

    const saveCall = vi.mocked(invoke).mock.calls.find((c) => c[0] === 'save_project');
    const args = saveCall![1] as { content: string };
    const parsed = JSON.parse(args.content);
    expect(parsed.timeline.tracks[0].clips[0].filePath).toBe('../videos/sample.mp4');
  });

  it('loadProjectFromPath で相対パスが絶対パスに復元される', async () => {
    const projectWithRelativePath: ProjectFile = {
      ...validProjectJson,
      timeline: {
        tracks: [{
          ...validProjectJson.timeline.tracks[0],
          clips: [{
            ...validProjectJson.timeline.tracks[0].clips[0],
            filePath: 'assets/sample.mp4',
          }],
        }],
      },
    };

    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'read_project') return JSON.stringify(projectWithRelativePath);
      if (cmd === 'get_file_info') return { name: 'sample.mp4', path: '/Users/test/projects/assets/sample.mp4', size: 1000, last_modified: 0 };
      return undefined;
    });

    await useProjectStore.getState().loadProjectFromPath('/Users/test/projects/myproject.qcut');

    const timeline = useTimelineStore.getState();
    expect(timeline.tracks[0].clips[0].filePath).toBe('/Users/test/projects/assets/sample.mp4');
  });

  it('loadProjectFromPath で旧形式の絶対パスはそのまま維持される（後方互換性）', async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'read_project') return JSON.stringify(validProjectJson);
      if (cmd === 'get_file_info') return { name: 'sample.mp4', path: '/videos/sample.mp4', size: 1000, last_modified: 0 };
      return undefined;
    });

    await useProjectStore.getState().loadProjectFromPath('/tmp/test.qcut');

    const timeline = useTimelineStore.getState();
    expect(timeline.tracks[0].clips[0].filePath).toBe('/videos/sample.mp4');
  });

  // --- autosave ---

  it('performAutosave は isDirty が false の場合何もしない', async () => {
    useProjectStore.setState({ isDirty: false });

    await useProjectStore.getState().performAutosave();

    expect(invoke).not.toHaveBeenCalled();
  });

  it('performAutosave は isDirty が true の場合に自動保存する', async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'get_autosave_path') return '/tmp/autosave-uuid.qcut';
      return undefined;
    });
    useProjectStore.setState({ isDirty: true, projectName: 'テスト' });

    await useProjectStore.getState().performAutosave();

    expect(invoke).toHaveBeenCalledWith('get_autosave_path');
    expect(invoke).toHaveBeenCalledWith('save_project', {
      path: '/tmp/autosave-uuid.qcut',
      content: expect.any(String),
    });
  });

  it('performAutosave は元のプロジェクトパスを metadata に記録する', async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'get_autosave_path') return '/tmp/autosave-uuid2.qcut';
      return undefined;
    });
    useProjectStore.setState({ isDirty: true, projectName: 'テスト', projectFilePath: '/tmp/original.qcut' });

    await useProjectStore.getState().performAutosave();

    const saveCall = vi.mocked(invoke).mock.calls.find((c) => c[0] === 'save_project');
    expect(saveCall).toBeDefined();
    const args = saveCall![1] as { content: string };
    const parsed = JSON.parse(args.content);
    expect(parsed.metadata.originalPath).toBe('/tmp/original.qcut');
  });

  it('checkAndRecoverAutosave は自動保存ファイルがない場合何もしない', async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'list_autosaves') return [];
      return undefined;
    });

    await useProjectStore.getState().checkAndRecoverAutosave();

    expect(ask).not.toHaveBeenCalled();
  });

  it('checkAndRecoverAutosave で復旧を選択するとプロジェクトが復元される', async () => {
    const autosaveProject = {
      ...validProjectJson,
      metadata: { ...validProjectJson.metadata, originalPath: '/tmp/original.qcut' },
    };
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'list_autosaves') return ['/tmp/autosave-abc.qcut'];
      if (cmd === 'read_project') return JSON.stringify(autosaveProject);
      if (cmd === 'delete_file') return undefined;
      return undefined;
    });
    vi.mocked(ask).mockResolvedValue(true);

    await useProjectStore.getState().checkAndRecoverAutosave();

    expect(useProjectStore.getState().projectFilePath).toBe('/tmp/original.qcut');
    expect(useProjectStore.getState().isDirty).toBe(true);
    expect(useTimelineStore.getState().tracks).toHaveLength(1);
    expect(invoke).toHaveBeenCalledWith('delete_file', { path: '/tmp/autosave-abc.qcut' });
  });

  it('checkAndRecoverAutosave で復旧を拒否しても自動保存ファイルは削除される', async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'list_autosaves') return ['/tmp/autosave-abc.qcut'];
      if (cmd === 'read_project') return JSON.stringify(validProjectJson);
      if (cmd === 'delete_file') return undefined;
      return undefined;
    });
    vi.mocked(ask).mockResolvedValue(false);

    await useProjectStore.getState().checkAndRecoverAutosave();

    expect(invoke).toHaveBeenCalledWith('delete_file', { path: '/tmp/autosave-abc.qcut' });
    // プロジェクトは復元されていない
    expect(useProjectStore.getState().projectFilePath).toBeNull();
  });

  it('scheduleAutosave でデバウンスタイマーが設定される', () => {
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    useProjectStore.getState().scheduleAutosave();
    expect(setTimeoutSpy).toHaveBeenCalled();

    setTimeoutSpy.mockRestore();
  });

  it('stopAutosave でタイマーがクリアされる', () => {
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');

    useProjectStore.getState().scheduleAutosave();
    useProjectStore.getState().stopAutosave();
    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });

  it('saveProject 成功時に自動保存ファイルが削除される', async () => {
    // まず performAutosave で autosaveFilePath を設定する
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'get_autosave_path') return '/tmp/autosave-test-uuid.qcut';
      if (cmd === 'save_project') return undefined;
      if (cmd === 'delete_file') return undefined;
      return undefined;
    });
    useProjectStore.setState({ isDirty: true, projectFilePath: '/tmp/test.qcut' });
    await useProjectStore.getState().performAutosave();

    // saveProject を実行
    vi.mocked(invoke).mockResolvedValue(undefined);
    await useProjectStore.getState().saveProject();

    // delete_file が autosaveFilePath で呼ばれることを確認
    const deleteCall = vi.mocked(invoke).mock.calls.find((c) => c[0] === 'delete_file');
    expect(deleteCall).toBeDefined();
    expect(deleteCall![1]).toEqual({ path: '/tmp/autosave-test-uuid.qcut' });
  });

  // --- 最近のプロジェクト ---

  it('loadRecentProjects でファイルを読み込み存在確認する', async () => {
    const recentData = [
      { name: 'Project1', path: '/tmp/project1.qcut', lastOpened: 1000 },
      { name: 'Project2', path: '/tmp/project2.qcut', lastOpened: 2000 },
    ];
    vi.mocked(invoke).mockImplementation(async (cmd: string, args?: Record<string, unknown>) => {
      if (cmd === 'read_recent_projects') return JSON.stringify(recentData);
      if (cmd === 'get_file_info') {
        if ((args as { path: string }).path === '/tmp/project2.qcut') throw new Error('not found');
        return { name: 'project1.qcut', path: '/tmp/project1.qcut', size: 100, last_modified: 0 };
      }
      return undefined;
    });

    await useProjectStore.getState().loadRecentProjects();

    const { recentProjects } = useProjectStore.getState();
    expect(recentProjects).toHaveLength(2);
    expect(recentProjects[0].exists).toBe(true);
    expect(recentProjects[1].exists).toBe(false);
  });

  it('addRecentProject に固定タイムスタンプを渡すと決定的に lastOpened が設定される', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);

    await useProjectStore.getState().addRecentProject('Test', '/tmp/test.qcut', 1700000000000);

    const { recentProjects } = useProjectStore.getState();
    expect(recentProjects[0].lastOpened).toBe(1700000000000);
  });

  it('addRecentProject で先頭に追加され最大10件に制限される', async () => {
    const existing = Array.from({ length: 10 }, (_, i) => ({
      name: `Project${i}`,
      path: `/tmp/project${i}.qcut`,
      lastOpened: i * 1000,
      exists: true,
    }));
    useProjectStore.setState({ recentProjects: existing });
    vi.mocked(invoke).mockResolvedValue(undefined);

    await useProjectStore.getState().addRecentProject('NewProject', '/tmp/new.qcut');

    const { recentProjects } = useProjectStore.getState();
    expect(recentProjects).toHaveLength(10);
    expect(recentProjects[0].name).toBe('NewProject');
    expect(recentProjects[0].path).toBe('/tmp/new.qcut');
    // 末尾の1件（project9）が削除されている
    expect(recentProjects.find((p) => p.path === '/tmp/project9.qcut')).toBeUndefined();
  });

  it('addRecentProject で重複パスは先頭に移動する', async () => {
    const existing = [
      { name: 'A', path: '/tmp/a.qcut', lastOpened: 1000, exists: true },
      { name: 'B', path: '/tmp/b.qcut', lastOpened: 2000, exists: true },
    ];
    useProjectStore.setState({ recentProjects: existing });
    vi.mocked(invoke).mockResolvedValue(undefined);

    await useProjectStore.getState().addRecentProject('B-updated', '/tmp/b.qcut');

    const { recentProjects } = useProjectStore.getState();
    expect(recentProjects).toHaveLength(2);
    expect(recentProjects[0].path).toBe('/tmp/b.qcut');
    expect(recentProjects[0].name).toBe('B-updated');
  });

  it('removeRecentProject で指定パスを削除する', async () => {
    const existing = [
      { name: 'A', path: '/tmp/a.qcut', lastOpened: 1000, exists: true },
      { name: 'B', path: '/tmp/b.qcut', lastOpened: 2000, exists: true },
    ];
    useProjectStore.setState({ recentProjects: existing });
    vi.mocked(invoke).mockResolvedValue(undefined);

    await useProjectStore.getState().removeRecentProject('/tmp/a.qcut');

    const { recentProjects } = useProjectStore.getState();
    expect(recentProjects).toHaveLength(1);
    expect(recentProjects[0].path).toBe('/tmp/b.qcut');
  });

  // --- クリップの全プロパティ保存・復元 ---

  const clipWithAllProperties = {
    id: 'clip-full',
    name: 'full.mp4',
    startTime: 0,
    duration: 10,
    filePath: '/videos/full.mp4',
    sourceStartTime: 0,
    sourceEndTime: 10,
    effects: {
      brightness: 1.2,
      contrast: 0.8,
      saturation: 1.5,
      colorTemperature: 0.3,
      hue: 10,
      hslRedSat: 0, hslYellowSat: 0, hslGreenSat: 0,
      hslCyanSat: 0, hslBlueSat: 0, hslMagentaSat: 0,
      liftR: 0, liftG: 0, liftB: 0,
      gammaR: 0, gammaG: 0, gammaB: 0,
      gainR: 0, gainG: 0, gainB: 0,
      rotation: 0, scaleX: 1, scaleY: 1,
      positionX: 0, positionY: 0,
      fadeIn: 0.5, fadeOut: 0.5,
      volume: 1, eqLow: 0, eqMid: 0, eqHigh: 0,
      denoiseAmount: 0, highpassFreq: 0,
      echoDelay: 0, echoDecay: 0.3, reverbAmount: 0,
      blurAmount: 0, sharpenAmount: 0, monochrome: 0,
    },
    toneCurves: {
      rgb: [{ x: 0, y: 0 }, { x: 0.5, y: 0.6 }, { x: 1, y: 1 }],
      r: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      g: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      b: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    },
    timecodeOverlay: {
      enabled: true,
      startDateTime: 1700000000000,
      format: 'hm' as const,
      positionX: 50,
      positionY: 10,
      fontSize: 24,
      fontColor: '#ffffff',
    },
    keyframes: {
      brightness: [
        { time: 0, value: 1.0, easing: 'linear' as const },
        { time: 5, value: 1.5, easing: 'easeOut' as const },
      ],
    },
  };

  const fullProjectJson: ProjectFile = {
    ...validProjectJson,
    timeline: {
      tracks: [{
        id: 'video-1',
        type: 'video',
        name: 'Video 1',
        volume: 1.0,
        mute: false,
        solo: false,
        clips: [clipWithAllProperties],
      }],
    },
  };

  it('saveProject がクリップの effects, toneCurves, timecodeOverlay, keyframes を含む', async () => {
    useTimelineStore.setState({
      tracks: fullProjectJson.timeline.tracks,
    });

    vi.mocked(invoke).mockResolvedValue(undefined);
    useProjectStore.setState({ projectFilePath: '/tmp/test.qcut' });

    await useProjectStore.getState().saveProject();

    const saveCall = vi.mocked(invoke).mock.calls.find((c) => c[0] === 'save_project');
    const args = saveCall![1] as { content: string };
    const parsed = JSON.parse(args.content);
    const clip = parsed.timeline.tracks[0].clips[0];

    expect(clip.effects).toBeDefined();
    expect(clip.effects.brightness).toBe(1.2);
    expect(clip.effects.contrast).toBe(0.8);

    expect(clip.toneCurves).toBeDefined();
    expect(clip.toneCurves.rgb).toHaveLength(3);
    expect(clip.toneCurves.rgb[1]).toEqual({ x: 0.5, y: 0.6 });

    expect(clip.timecodeOverlay).toBeDefined();
    expect(clip.timecodeOverlay.enabled).toBe(true);
    expect(clip.timecodeOverlay.fontSize).toBe(24);

    expect(clip.keyframes).toBeDefined();
    expect(clip.keyframes.brightness).toHaveLength(2);
    expect(clip.keyframes.brightness[1].value).toBe(1.5);
  });

  it('loadProjectFromPath でクリップの全プロパティが復元される（ラウンドトリップ）', async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'read_project') return JSON.stringify(fullProjectJson);
      if (cmd === 'get_file_info') return { name: 'full.mp4', path: '/videos/full.mp4', size: 1000, last_modified: 0 };
      return undefined;
    });

    await useProjectStore.getState().loadProjectFromPath('/tmp/full.qcut');

    const timeline = useTimelineStore.getState();
    const clip = timeline.tracks[0].clips[0];

    // effects
    expect(clip.effects).toBeDefined();
    expect(clip.effects!.brightness).toBe(1.2);
    expect(clip.effects!.fadeIn).toBe(0.5);

    // toneCurves
    expect(clip.toneCurves).toBeDefined();
    expect(clip.toneCurves!.rgb).toHaveLength(3);
    expect(clip.toneCurves!.rgb[1]).toEqual({ x: 0.5, y: 0.6 });

    // timecodeOverlay
    expect(clip.timecodeOverlay).toBeDefined();
    expect(clip.timecodeOverlay!.enabled).toBe(true);
    expect(clip.timecodeOverlay!.startDateTime).toBe(1700000000000);

    // keyframes
    expect(clip.keyframes).toBeDefined();
    expect(clip.keyframes!.brightness).toHaveLength(2);
    expect(clip.keyframes!.brightness![0].easing).toBe('linear');
    expect(clip.keyframes!.brightness![1].value).toBe(1.5);
  });

  it('clearRecentProjects で全件削除する', async () => {
    useProjectStore.setState({
      recentProjects: [{ name: 'A', path: '/tmp/a.qcut', lastOpened: 1000, exists: true }],
    });
    vi.mocked(invoke).mockResolvedValue(undefined);

    await useProjectStore.getState().clearRecentProjects();

    expect(useProjectStore.getState().recentProjects).toHaveLength(0);
    expect(invoke).toHaveBeenCalledWith('write_recent_projects', { content: '[]' });
  });
});
