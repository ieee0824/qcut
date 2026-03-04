import { create } from 'zustand';

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  lastModified: number;
}

export interface FileOperationsState {
  // 現在のファイル
  currentFile: FileInfo | null;
  isLoading: boolean;

  // 最近使ったファイル（最大 10 件）
  recentFiles: FileInfo[];

  // 操作メソッド
  setCurrentFile: (file: FileInfo) => void;
  setIsLoading: (loading: boolean) => void;
  addRecentFile: (file: FileInfo) => void;
  clearRecentFiles: () => void;
  removeRecentFile: (path: string) => void;
}

export const useFileOperationsStore =
  create<FileOperationsState>((set) => ({
    currentFile: null,
    isLoading: false,
    recentFiles: [],

    setCurrentFile: (file) => set({ currentFile: file }),
    setIsLoading: (loading) => set({ isLoading: loading }),

    addRecentFile: (file) =>
      set((state) => {
        // 同じファイルが既に存在する場合は削除
        const filtered = state.recentFiles.filter(
          (f) => f.path !== file.path
        );
        // 最新ファイルを先頭に追加、最大 10 件まで保持
        return {
          recentFiles: [file, ...filtered].slice(0, 10),
        };
      }),

    clearRecentFiles: () => set({ recentFiles: [] }),

    removeRecentFile: (path) =>
      set((state) => ({
        recentFiles: state.recentFiles.filter((f) => f.path !== path),
      })),
  }));
