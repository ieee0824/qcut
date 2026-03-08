import { create } from 'zustand';

export interface VideoPreviewState {
  // 再生状態
  isPlaying: boolean;
  currentTime: number; // 秒単位
  duration: number; // 秒単位
  volume: number; // 0-100

  // プレビューコンテナサイズ
  previewContainerHeight: number;

  // 動画ファイル情報
  videoFile: File | null;
  videoUrl: string | null;
  videoUrls: Record<string, string>; // filePath → objectURL のマップ

  // 操作メソッド
  setIsPlaying: (playing: boolean) => void;
  setPreviewContainerHeight: (height: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setVideoFile: (file: File, fullPath?: string) => void;
  setVideoUrl: (url: string) => void;
  registerVideoUrl: (filePath: string, url: string) => void;
  resetPreview: () => void;
}

export const useVideoPreviewStore = create<VideoPreviewState>((set) => ({
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 100,
  previewContainerHeight: 0,
  videoFile: null,
  videoUrl: null,
  videoUrls: {},

  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPreviewContainerHeight: (height) => set({ previewContainerHeight: height }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(100, volume)) }),
  setVideoFile: (file, fullPath?: string) => {
    const url = URL.createObjectURL(file);
    const key = fullPath ?? file.name;
    set((state) => ({
      videoFile: file,
      videoUrl: url,
      videoUrls: { ...state.videoUrls, [key]: url },
    }));
  },
  setVideoUrl: (url) => set({ videoUrl: url }),
  registerVideoUrl: (filePath, url) =>
    set((state) => ({ videoUrls: { ...state.videoUrls, [filePath]: url } })),
  resetPreview: () =>
    set({
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      videoFile: null,
      videoUrl: null,
      videoUrls: {},
    }),
}));
