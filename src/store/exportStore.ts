import { create } from 'zustand';

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

  setStatus: (status: ExportStatus) => void;
  setProgress: (progress: number, currentTime: number) => void;
  setError: (message: string) => void;
  setDialogOpen: (open: boolean) => void;
  setSettings: (settings: Partial<ExportSettings>) => void;
  setOutputPath: (path: string) => void;
  setFormatOptions: (options: FormatOption[]) => void;
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
  setFormatOptions: (options) => set({ formatOptions: options }),
  reset: () => set({
    status: 'idle',
    progress: 0,
    currentTime: 0,
    errorMessage: null,
    outputPath: null,
    exportStartedAt: null,
  }),
}));
