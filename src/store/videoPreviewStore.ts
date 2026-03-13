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

  // キーフレームマーカードラッグ中の一時的なプレビュー時刻（canvas エフェクト補間のみに使用）
  kfDragPreviewTime: number | null;

  // 次クリップ切り替え時に一瞬黒くならないよう、先読みした先頭フレームを保持
  prerenderedFrames: Record<string, string>;

  // 操作メソッド
  setIsPlaying: (playing: boolean) => void;
  setPreviewContainerHeight: (height: number) => void;
  setCurrentTime: (time: number) => void;
  setKfDragPreviewTime: (time: number | null) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setPrerenderedFrame: (clipId: string, frameUrl: string) => void;
  clearPrerenderedFrame: (clipId: string) => void;
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
  kfDragPreviewTime: null,
  prerenderedFrames: {},

  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPreviewContainerHeight: (height) => set({ previewContainerHeight: height }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setKfDragPreviewTime: (time) => set({ kfDragPreviewTime: time }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(100, volume)) }),
  setPrerenderedFrame: (clipId, frameUrl) =>
    set((state) => ({
      prerenderedFrames: { ...state.prerenderedFrames, [clipId]: frameUrl },
    })),
  clearPrerenderedFrame: (clipId) =>
    set((state) => {
      if (!(clipId in state.prerenderedFrames)) {
        return state;
      }
      const nextFrames = { ...state.prerenderedFrames };
      delete nextFrames[clipId];
      return { prerenderedFrames: nextFrames };
    }),
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
      prerenderedFrames: {},
    }),
}));
