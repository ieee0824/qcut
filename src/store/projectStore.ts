import { create } from 'zustand';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { ask, message, open, save } from '@tauri-apps/plugin-dialog';
import type { ProjectFile } from '../types/projectFile';
import { CURRENT_SCHEMA_VERSION } from '../types/projectFile';
import { useTimelineStore } from './timelineStore';
import { useExportStore } from './exportStore';
import { useVideoPreviewStore } from './videoPreviewStore';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface ProjectState {
  projectFilePath: string | null;
  projectName: string;
  isDirty: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;
  loadStatus: LoadStatus;
  loadError: string | null;
  missingFiles: string[];

  setProjectFilePath: (path: string | null) => void;
  setProjectName: (name: string) => void;
  markDirty: () => void;
  markClean: () => void;

  saveProject: () => Promise<void>;
  saveProjectAs: () => Promise<void>;
  openProject: () => Promise<void>;
  loadProjectFromPath: (path: string) => Promise<void>;
}

function buildProjectFile(projectName: string): ProjectFile {
  const timeline = useTimelineStore.getState();
  const exportSettings = useExportStore.getState().settings;

  const tracks = timeline.tracks.map((track) => ({
    id: track.id,
    type: track.type,
    name: track.name,
    volume: track.volume,
    mute: track.mute,
    solo: track.solo,
    clips: track.clips.map((clip) => ({
      id: clip.id,
      name: clip.name,
      startTime: clip.startTime,
      duration: clip.duration,
      color: clip.color,
      filePath: clip.filePath,
      sourceStartTime: clip.sourceStartTime,
      sourceEndTime: clip.sourceEndTime,
      effects: clip.effects,
      textProperties: clip.textProperties,
      transition: clip.transition,
    })),
  }));

  const now = new Date().toISOString();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion: '0.1.0',
    createdAt: now,
    updatedAt: now,
    metadata: {
      name: projectName,
    },
    timeline: {
      tracks,
    },
    exportSettings,
  };
}

async function writeProjectFile(path: string, projectName: string): Promise<void> {
  const projectFile = buildProjectFile(projectName);
  const content = JSON.stringify(projectFile, null, 2);
  await invoke('save_project', { path, content });
}

function validateProjectFile(data: unknown): ProjectFile {
  const obj = data as Record<string, unknown>;
  if (!obj || typeof obj !== 'object') {
    throw new Error('無効なプロジェクトファイルです');
  }
  if (typeof obj.schemaVersion !== 'number') {
    throw new Error('スキーマバージョンが見つかりません');
  }
  if (obj.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `このファイルはより新しいバージョン (v${obj.schemaVersion}) で作成されています。アプリを更新してください。`
    );
  }
  if (!obj.timeline || typeof obj.timeline !== 'object') {
    throw new Error('タイムラインデータが見つかりません');
  }
  return data as ProjectFile;
}

function applyProjectToStores(project: ProjectFile): void {
  // タイムラインをリセットしてトラックを復元
  useTimelineStore.setState({
    tracks: project.timeline.tracks.map((track) => ({
      id: track.id,
      type: track.type,
      name: track.name,
      volume: track.volume,
      mute: track.mute,
      solo: track.solo,
      clips: track.clips.map((clip) => ({
        id: clip.id,
        name: clip.name,
        startTime: clip.startTime,
        duration: clip.duration,
        color: clip.color,
        filePath: clip.filePath,
        sourceStartTime: clip.sourceStartTime,
        sourceEndTime: clip.sourceEndTime,
        effects: clip.effects,
        textProperties: clip.textProperties,
        transition: clip.transition,
      })),
    })),
    selectedClipId: null,
    selectedTrackId: null,
    currentTime: 0,
    isPlaying: false,
    _history: [project.timeline.tracks],
    _historyIndex: 0,
  });

  // 動画ファイルの URL を videoPreviewStore に登録
  const videoPreview = useVideoPreviewStore.getState();
  for (const track of project.timeline.tracks) {
    if (track.type === 'text') continue;
    for (const clip of track.clips) {
      if (clip.filePath) {
        const assetUrl = convertFileSrc(clip.filePath);
        videoPreview.registerVideoUrl(clip.filePath, assetUrl);
      }
    }
  }

  // エクスポート設定を復元
  if (project.exportSettings) {
    useExportStore.getState().setSettings(project.exportSettings);
  }
}

async function checkMissingFiles(project: ProjectFile): Promise<string[]> {
  const missing: string[] = [];
  for (const track of project.timeline.tracks) {
    for (const clip of track.clips) {
      if (clip.filePath && track.type !== 'text') {
        try {
          await invoke('get_file_info', { path: clip.filePath });
        } catch {
          missing.push(clip.filePath);
        }
      }
    }
  }
  return missing;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectFilePath: null,
  projectName: '無題のプロジェクト',
  isDirty: false,
  saveStatus: 'idle',
  saveError: null,
  loadStatus: 'idle',
  loadError: null,
  missingFiles: [],

  setProjectFilePath: (path) => set({ projectFilePath: path }),
  setProjectName: (name) => set({ projectName: name }),
  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false, saveStatus: 'saved' }),

  saveProject: async () => {
    const { projectFilePath, projectName } = get();

    if (!projectFilePath) {
      return get().saveProjectAs();
    }

    set({ saveStatus: 'saving', saveError: null });
    try {
      await writeProjectFile(projectFilePath, projectName);
      set({ isDirty: false, saveStatus: 'saved', saveError: null });
      setTimeout(() => {
        if (get().saveStatus === 'saved') {
          set({ saveStatus: 'idle' });
        }
      }, 2000);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      set({ saveStatus: 'error', saveError: errorMsg });
      await message(errorMsg, { title: 'qcut', kind: 'error' });
    }
  },

  saveProjectAs: async () => {
    const { projectName } = get();

    const filePath = await save({
      defaultPath: `${projectName}.qcut`,
      filters: [
        { name: 'qcut Project', extensions: ['qcut'] },
      ],
    });

    if (!filePath) return;

    const name = filePath.split('/').pop()?.replace(/\.qcut$/, '')
      ?? filePath.split('\\').pop()?.replace(/\.qcut$/, '')
      ?? projectName;

    set({ projectFilePath: filePath, projectName: name, saveStatus: 'saving', saveError: null });
    try {
      await writeProjectFile(filePath, name);
      set({ isDirty: false, saveStatus: 'saved', saveError: null });
      setTimeout(() => {
        if (get().saveStatus === 'saved') {
          set({ saveStatus: 'idle' });
        }
      }, 2000);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      set({ saveStatus: 'error', saveError: errorMsg });
      await message(errorMsg, { title: 'qcut', kind: 'error' });
    }
  },

  openProject: async () => {
    if (get().isDirty) {
      const proceed = await ask(
        '未保存の変更があります。保存せずに別のプロジェクトを開きますか？',
        { title: 'qcut', kind: 'warning' },
      );
      if (!proceed) return;
    }

    const filePath = await open({
      multiple: false,
      filters: [
        { name: 'qcut Project', extensions: ['qcut'] },
      ],
    });

    if (!filePath) return;
    await get().loadProjectFromPath(filePath as string);
  },

  loadProjectFromPath: async (path: string) => {
    set({ loadStatus: 'loading', loadError: null, missingFiles: [] });
    try {
      const content = await invoke<string>('read_project', { path });
      const parsed = JSON.parse(content);
      const project = validateProjectFile(parsed);

      const missing = await checkMissingFiles(project);

      applyProjectToStores(project);

      const name = path.split('/').pop()?.replace(/\.qcut$/, '')
        ?? path.split('\\').pop()?.replace(/\.qcut$/, '')
        ?? project.metadata.name;

      set({
        projectFilePath: path,
        projectName: name,
        isDirty: false,
        loadStatus: 'loaded',
        loadError: null,
        missingFiles: missing,
        saveStatus: 'idle',
        saveError: null,
      });

      setTimeout(() => {
        if (get().loadStatus === 'loaded') {
          set({ loadStatus: 'idle' });
        }
      }, 2000);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      set({ loadStatus: 'error', loadError: errorMsg });
      await message(errorMsg, { title: 'qcut', kind: 'error' });
    }
  },
}));

// タイムラインの変更を監視して isDirty を自動更新
useTimelineStore.subscribe(
  (state, prevState) => {
    if (state.tracks !== prevState.tracks) {
      const { loadStatus } = useProjectStore.getState();
      // プロジェクト読み込み中の変更は無視
      if (loadStatus !== 'loading') {
        useProjectStore.getState().markDirty();
      }
    }
  },
);
