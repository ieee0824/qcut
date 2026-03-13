import { create } from 'zustand';
import type { ExportFormatProfile } from '../plugin-system/types/api';

export type { ExportFormatProfile };
export type ExportStatus = 'idle' | 'configuring' | 'exporting' | 'complete' | 'error' | 'cancelled';
export type ExportFormat = string;

export interface FormatOption {
  key: string;
  label: string;
  ext: string;
  filterName: string;
}

export const DEFAULT_FORMAT_OPTIONS: FormatOption[] = [
  { key: 'mp4', label: 'MP4 (H.264)', ext: 'mp4', filterName: 'MP4' },
  { key: 'mov', label: 'MOV (H.264)', ext: 'mov', filterName: 'MOV' },
  { key: 'avi', label: 'AVI (H.264)', ext: 'avi', filterName: 'AVI' },
  { key: 'webm', label: 'WebM (VP9)', ext: 'webm', filterName: 'WebM' },
];

export interface ExportSettings {
  format: ExportFormat;
  width: number;
  height: number;
  bitrate: string;
  fps: number;
}

export interface ExportState {
  status: ExportStatus;
  progress: number;
  currentTime: number;
  errorMessage: string | null;
  isDialogOpen: boolean;
  settings: ExportSettings;
  outputPath: string | null;
  exportStartedAt: number | null;
  formatOptions: FormatOption[];
  customFormatProfiles: Record<string, ExportFormatProfile>;

  setStatus: (status: ExportStatus) => void;
  setProgress: (progress: number, currentTime: number) => void;
  setError: (message: string) => void;
  setDialogOpen: (open: boolean) => void;
  setSettings: (settings: Partial<ExportSettings>) => void;
  setOutputPath: (path: string) => void;
  setFormatOptions: (options: FormatOption[]) => void;
  registerCustomFormat: (profile: ExportFormatProfile) => void;
  unregisterCustomFormat: (key: string) => void;
  reset: () => void;
}

const DEFAULT_SETTINGS: ExportSettings = {
  format: 'mp4',
  width: 1920,
  height: 1080,
  bitrate: '8M',
  fps: 30,
};

export const useExportStore = create<ExportState>((set) => ({
  status: 'idle',
  progress: 0,
  currentTime: 0,
  errorMessage: null,
  isDialogOpen: false,
  settings: { ...DEFAULT_SETTINGS },
  outputPath: null,
  exportStartedAt: null,
  formatOptions: DEFAULT_FORMAT_OPTIONS,
  customFormatProfiles: {},

  setStatus: (status) => set((state) => ({
    status,
    exportStartedAt: status === 'exporting' ? (state.exportStartedAt ?? Date.now()) : state.exportStartedAt,
  })),
  setProgress: (progress, currentTime) => set({ progress, currentTime }),
  setError: (message) => set({ status: 'error', errorMessage: message }),
  setDialogOpen: (open) => set({ isDialogOpen: open }),
  setSettings: (partial) => set((state) => ({
    settings: { ...state.settings, ...partial },
  })),
  setOutputPath: (path) => set({ outputPath: path }),
  // バックエンド取得フォーマットで上書きする際、既登録カスタムフォーマットを保持する
  // key 単位でマージし、同一 key はカスタム側を優先する
  setFormatOptions: (options) => set((state) => {
    const customKeys = Object.keys(state.customFormatProfiles);
    const existingCustom = state.formatOptions.filter((o) => customKeys.includes(o.key));
    const mergedByKey = new Map<string, FormatOption>();
    options.forEach((option) => mergedByKey.set(option.key, option));
    existingCustom.forEach((customOption) => mergedByKey.set(customOption.key, customOption));
    return { formatOptions: Array.from(mergedByKey.values()) };
  }),
  registerCustomFormat: (profile) => set((state) => {
    if (state.customFormatProfiles[profile.key] || state.formatOptions.some((o) => o.key === profile.key)) return state;
    return {
      formatOptions: [
        ...state.formatOptions,
        { key: profile.key, label: profile.label, ext: profile.ext, filterName: profile.filterName },
      ],
      customFormatProfiles: { ...state.customFormatProfiles, [profile.key]: profile },
    };
  }),
  unregisterCustomFormat: (key) => set((state) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [key]: _removed, ...rest } = state.customFormatProfiles;
    const newSettings = state.settings.format === key
      ? { ...state.settings, format: DEFAULT_SETTINGS.format }
      : state.settings;
    return {
      formatOptions: state.formatOptions.filter((o) => o.key !== key),
      customFormatProfiles: rest,
      settings: newSettings,
    };
  }),
  reset: () => set({
    status: 'idle',
    progress: 0,
    currentTime: 0,
    errorMessage: null,
    outputPath: null,
    exportStartedAt: null,
  }),
}));

