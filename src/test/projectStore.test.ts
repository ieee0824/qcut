import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { useProjectStore } from '../store/projectStore';
import { useTimelineStore } from '../store/timelineStore';
import { useExportStore } from '../store/exportStore';

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
});
