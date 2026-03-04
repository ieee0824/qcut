import { create } from 'zustand';

export const useTimelineStore = create((set) => ({
  // タイムライン設定
  pixelsPerSecond: 50, // 1秒あたりのピクセル数（ズームレベル）
  currentTime: 0, // 現在の再生位置（秒）
  duration: 0, // 全体の長さ（秒）
  isPlaying: false, // 再生中かどうか
  
  // トラック
  tracks: [
    { id: 'video-1', type: 'video', name: 'Video 1', clips: [] },
    { id: 'video-2', type: 'video', name: 'Video 2', clips: [] },
    { id: 'audio-1', type: 'audio', name: 'Audio 1', clips: [] },
  ],
  
  // アクション
  setPixelsPerSecond: (pps) => set({ pixelsPerSecond: pps }),
  
  setCurrentTime: (time) => set({ currentTime: time }),
  
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  
  addClip: (trackId, clip) => set((state) => ({
    tracks: state.tracks.map(track => 
      track.id === trackId 
        ? { ...track, clips: [...track.clips, clip] }
        : track
    ),
  })),
  
  removeClip: (trackId, clipId) => set((state) => ({
    tracks: state.tracks.map(track =>
      track.id === trackId
        ? { ...track, clips: track.clips.filter(c => c.id !== clipId) }
        : track
    ),
  })),
  
  updateClip: (trackId, clipId, updates) => set((state) => ({
    tracks: state.tracks.map(track =>
      track.id === trackId
        ? {
            ...track,
            clips: track.clips.map(clip =>
              clip.id === clipId ? { ...clip, ...updates } : clip
            ),
          }
        : track
    ),
  })),
  
  addTrack: (track) => set((state) => ({
    tracks: [...state.tracks, track],
  })),
  
  removeTrack: (trackId) => set((state) => ({
    tracks: state.tracks.filter(t => t.id !== trackId),
  })),
  
  // ズーム
  zoomIn: () => set((state) => ({
    pixelsPerSecond: Math.min(state.pixelsPerSecond * 1.2, 200),
  })),
  
  zoomOut: () => set((state) => ({
    pixelsPerSecond: Math.max(state.pixelsPerSecond / 1.2, 10),
  })),
}));
