import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import type { ProjectFile } from '../types/projectFile';
import { CURRENT_SCHEMA_VERSION } from '../types/projectFile';
import { useTimelineStore } from './timelineStore';
import { useExportStore } from './exportStore';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface ProjectState {
  projectFilePath: string | null;
  projectName: string;
  isDirty: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;

  setProjectFilePath: (path: string | null) => void;
  setProjectName: (name: string) => void;
  markDirty: () => void;
  markClean: () => void;

  saveProject: () => Promise<void>;
  saveProjectAs: () => Promise<void>;
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

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectFilePath: null,
  projectName: '無題のプロジェクト',
  isDirty: false,
  saveStatus: 'idle',
  saveError: null,

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
      const message = e instanceof Error ? e.message : String(e);
      set({ saveStatus: 'error', saveError: message });
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
      const message = e instanceof Error ? e.message : String(e);
      set({ saveStatus: 'error', saveError: message });
    }
  },
}));
