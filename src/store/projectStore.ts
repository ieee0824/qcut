import { create } from 'zustand';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { ask, message, open, save } from '@tauri-apps/plugin-dialog';
import type { ProjectFile } from '../types/projectFile';
import { CURRENT_SCHEMA_VERSION } from '../types/projectFile';
import { useTimelineStore } from './timelineStore';
import { useExportStore } from './exportStore';
import { useVideoPreviewStore } from './videoPreviewStore';
import i18n from '../i18n';
import { toRelativePath, resolveRelativePath, getDirectoryPath } from '../utils/pathUtils';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

let autosaveTimerId: number | null = null;
let autosaveFilePath: string | null = null;
let isRecoveringAutosave = false;

/** テスト用: モジュールレベル変数をリセットする */
export function _resetAutosaveState(): void {
  if (autosaveTimerId !== null) {
    clearTimeout(autosaveTimerId);
  }
  autosaveTimerId = null;
  autosaveFilePath = null;
  isRecoveringAutosave = false;
}

export const AUTOSAVE_DEBOUNCE_MS = 5 * 1000; // 編集操作後5秒で自動保存
export const MAX_RECENT_PROJECTS = 10;

export interface RecentProject {
  name: string;
  path: string;
  lastOpened: number;
  exists?: boolean;
}

export interface ProjectState {
  projectFilePath: string | null;
  projectName: string;
  isDirty: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;
  loadStatus: LoadStatus;
  loadError: string | null;
  missingFiles: string[];
  recentProjects: RecentProject[];

  setProjectFilePath: (path: string | null) => void;
  setProjectName: (name: string) => void;
  markDirty: () => void;
  markClean: () => void;

  saveProject: () => Promise<void>;
  saveProjectAs: () => Promise<void>;
  openProject: () => Promise<void>;
  loadProjectFromPath: (path: string) => Promise<void>;

  // 自動保存
  startAutosave: () => void;
  stopAutosave: () => void;
  scheduleAutosave: () => void;
  performAutosave: () => Promise<void>;
  checkAndRecoverAutosave: () => Promise<void>;
  deleteAutosave: () => Promise<void>;

  // 最近のプロジェクト
  loadRecentProjects: () => Promise<void>;
  addRecentProject: (name: string, path: string) => Promise<void>;
  removeRecentProject: (path: string) => Promise<void>;
  clearRecentProjects: () => Promise<void>;
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
      keyframes: clip.keyframes,
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
  // 保存先ディレクトリを基準に素材パスを相対パスに変換
  const projectDir = getDirectoryPath(path);
  for (const track of projectFile.timeline.tracks) {
    for (const clip of track.clips) {
      if (clip.filePath) {
        clip.filePath = toRelativePath(clip.filePath, projectDir);
      }
    }
  }
  const content = JSON.stringify(projectFile, null, 2);
  await invoke('save_project', { path, content });
}

function validateProjectFile(data: unknown): ProjectFile {
  const obj = data as Record<string, unknown>;
  if (!obj || typeof obj !== 'object') {
    throw new Error(i18n.t('project.invalidFile'));
  }
  if (typeof obj.schemaVersion !== 'number') {
    throw new Error(i18n.t('project.schemaNotFound'));
  }
  if (obj.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      i18n.t('project.newerVersion', { version: obj.schemaVersion })
    );
  }
  if (!obj.timeline || typeof obj.timeline !== 'object') {
    throw new Error(i18n.t('project.timelineNotFound'));
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
        keyframes: clip.keyframes,
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
  projectName: i18n.t('project.untitled'),
  isDirty: false,
  saveStatus: 'idle',
  saveError: null,
  loadStatus: 'idle',
  loadError: null,
  missingFiles: [],
  recentProjects: [],

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
      // 手動保存成功時に自動保存ファイルを削除
      get().deleteAutosave();
      get().addRecentProject(projectName, projectFilePath);
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
      // 手動保存成功時に自動保存ファイルを削除
      get().deleteAutosave();
      get().addRecentProject(name, filePath);
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
        i18n.t('project.unsavedOpenConfirm'),
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

      // 相対パスを絶対パスに解決（後方互換: 絶対パスはそのまま）
      const projectDir = getDirectoryPath(path);
      for (const track of project.timeline.tracks) {
        for (const clip of track.clips) {
          if (clip.filePath) {
            clip.filePath = resolveRelativePath(clip.filePath, projectDir);
          }
        }
      }

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

      get().addRecentProject(name, path);

      if (missing.length > 0) {
        await message(
          i18n.t('project.missingFiles', { files: missing.join('\n') }),
          { title: 'qcut', kind: 'warning' },
        );
      }

      setTimeout(() => {
        if (get().loadStatus === 'loaded') {
          set({ loadStatus: 'idle' });
        }
      }, 2000);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error('[projectStore] loadProjectFromPath failed:', errorMsg);
      set({ loadStatus: 'error', loadError: errorMsg });
      await message(i18n.t('project.corruptFile'), { title: 'qcut', kind: 'error' });
    }
  },

  // --- 自動保存 ---

  startAutosave: () => {
    // no-op: デバウンスはタイムライン変更の subscribe で発火する
  },

  stopAutosave: () => {
    if (autosaveTimerId !== null) {
      clearTimeout(autosaveTimerId);
      autosaveTimerId = null;
    }
  },

  scheduleAutosave: () => {
    // 既存のタイマーをリセットしてデバウンス
    if (autosaveTimerId !== null) {
      clearTimeout(autosaveTimerId);
    }
    autosaveTimerId = window.setTimeout(() => {
      autosaveTimerId = null;
      useProjectStore.getState().performAutosave();
    }, AUTOSAVE_DEBOUNCE_MS);
  },

  performAutosave: async () => {
    const { isDirty, projectName, projectFilePath } = get();
    if (!isDirty) return;

    try {
      // 初回は UUID パスを生成、以降は同じパスに上書き
      if (!autosaveFilePath) {
        autosaveFilePath = await invoke<string>('get_autosave_path');
      }
      const projectFile = buildProjectFile(projectName);
      // 元のプロジェクトファイルパスを metadata に記録（復旧時に使用）
      if (projectFilePath) {
        projectFile.metadata.originalPath = projectFilePath;
      }
      const content = JSON.stringify(projectFile, null, 2);
      await invoke('save_project', { path: autosaveFilePath, content });
      console.info('[autosave] 自動保存完了:', autosaveFilePath);
    } catch (e) {
      console.error('[autosave] 自動保存に失敗:', e);
    }
  },

  checkAndRecoverAutosave: async () => {
    // React StrictMode による二重実行を防止
    if (isRecoveringAutosave) return;
    isRecoveringAutosave = true;

    try {
      const autosaveFiles = await invoke<string[]>('list_autosaves');
      if (autosaveFiles.length === 0) return;

      for (const autosavePath of autosaveFiles) {
        try {
          const content = await invoke<string>('read_project', { path: autosavePath });
          const parsed = JSON.parse(content);
          const project = validateProjectFile(parsed);

          const originalPath = project.metadata.originalPath;
          const displayName = originalPath
            ? (originalPath.split('/').pop() ?? originalPath.split('\\').pop() ?? project.metadata.name)
            : project.metadata.name;

          const recover = await ask(
            i18n.t('project.autosaveRecover', { name: displayName }),
            { title: 'qcut', kind: 'info' },
          );

          if (recover) {
            // loadStatus を 'loading' にして subscriber が autosave をスケジュールしないようにする
            set({ loadStatus: 'loading' });

            applyProjectToStores(project);

            const name = originalPath
              ? (originalPath.split('/').pop()?.replace(/\.qcut$/, '')
                ?? originalPath.split('\\').pop()?.replace(/\.qcut$/, '')
                ?? project.metadata.name)
              : project.metadata.name;

            set({
              projectFilePath: originalPath ?? null,
              projectName: name,
              isDirty: true,
              loadStatus: 'loaded',
              loadError: null,
            });

            setTimeout(() => {
              if (get().loadStatus === 'loaded') {
                set({ loadStatus: 'idle' });
              }
            }, 2000);

            // 復旧後すぐに新しい autosave を作成し、強制終了時のデータ喪失を防ぐ
            get().performAutosave();
          }
        } catch {
          // 壊れた自動保存ファイルも削除対象
        }

        // 復旧してもしなくても自動保存ファイルを削除
        try {
          await invoke('delete_file', { path: autosavePath });
        } catch { /* ignore */ }
      }
    } catch (e) {
      console.error('[autosave] 復旧チェックに失敗:', e);
    } finally {
      isRecoveringAutosave = false;
    }
  },

  deleteAutosave: async () => {
    if (!autosaveFilePath) return;
    try {
      await invoke('delete_file', { path: autosaveFilePath });
      autosaveFilePath = null;
    } catch (e) {
      console.error('[autosave] 削除に失敗:', e);
    }
  },

  // --- 最近のプロジェクト ---

  loadRecentProjects: async () => {
    try {
      const json = await invoke<string>('read_recent_projects');
      const projects: RecentProject[] = JSON.parse(json);

      // 各ファイルの存在確認
      const checked = await Promise.all(
        projects.map(async (p) => {
          try {
            await invoke('get_file_info', { path: p.path });
            return { ...p, exists: true };
          } catch {
            return { ...p, exists: false };
          }
        }),
      );

      set({ recentProjects: checked });
    } catch (e) {
      console.error('[recentProjects] 読み込みに失敗:', e);
    }
  },

  addRecentProject: async (name: string, path: string) => {
    const { recentProjects } = get();
    const filtered = recentProjects.filter((p) => p.path !== path);
    const updated: RecentProject[] = [
      { name, path, lastOpened: Date.now(), exists: true },
      ...filtered,
    ].slice(0, MAX_RECENT_PROJECTS);

    set({ recentProjects: updated });

    try {
      const toSave = updated.map(({ name, path, lastOpened }) => ({ name, path, lastOpened }));
      await invoke('write_recent_projects', { content: JSON.stringify(toSave) });
    } catch (e) {
      console.error('[recentProjects] 書き込みに失敗:', e);
    }
  },

  removeRecentProject: async (path: string) => {
    const updated = get().recentProjects.filter((p) => p.path !== path);
    set({ recentProjects: updated });

    try {
      const toSave = updated.map(({ name, path, lastOpened }) => ({ name, path, lastOpened }));
      await invoke('write_recent_projects', { content: JSON.stringify(toSave) });
    } catch (e) {
      console.error('[recentProjects] 書き込みに失敗:', e);
    }
  },

  clearRecentProjects: async () => {
    set({ recentProjects: [] });
    try {
      await invoke('write_recent_projects', { content: '[]' });
    } catch (e) {
      console.error('[recentProjects] クリアに失敗:', e);
    }
  },
}));

// タイムラインの変更を監視して isDirty を自動更新し、自動保存をスケジュール
useTimelineStore.subscribe(
  (state, prevState) => {
    if (state.tracks !== prevState.tracks) {
      const { loadStatus } = useProjectStore.getState();
      // プロジェクト読み込み中の変更は無視
      if (loadStatus !== 'loading') {
        useProjectStore.getState().markDirty();
        useProjectStore.getState().scheduleAutosave();
      }
    }
  },
);
