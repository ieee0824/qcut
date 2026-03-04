import { create } from 'zustand';

export interface Clip {
  id: string;
  name: string;
  startTime: number;
  duration: number;
  color?: string;
}

export interface Track {
  id: string;
  type: 'video' | 'audio';
  name: string;
  clips: Clip[];
}

export interface TimelineState {
  // タイムライン設定
  pixelsPerSecond: number;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  
  // トラック
  tracks: Track[];
  
  // 選択状態
  selectedClipId: string | null;
  selectedTrackId: string | null;
  
  // アクション
  setPixelsPerSecond: (pps: number) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  addClip: (trackId: string, clip: Clip) => void;
  removeClip: (trackId: string, clipId: string) => void;
  updateClip: (trackId: string, clipId: string, updates: Partial<Clip>) => void;
  addTrack: (track: Track) => void;
  removeTrack: (trackId: string) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  
  // カット編集機能
  setSelectedClip: (trackId: string | null, clipId: string | null) => void;
  splitClipAtTime: (trackId: string, clipId: string, splitTime: number) => void;
  deleteSelectedClip: () => void;
}

export const useTimelineStore = create<TimelineState>((set) => ({
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
  
  // 選択状態
  selectedClipId: null,
  selectedTrackId: null,
  
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
  
  // カット編集機能
  setSelectedClip: (trackId, clipId) => set({
    selectedTrackId: trackId,
    selectedClipId: clipId,
  }),
  
  splitClipAtTime: (trackId, clipId, splitTime) => set((state) => {
    const track = state.tracks.find(t => t.id === trackId);
    if (!track) return state;
    
    const clip = track.clips.find(c => c.id === clipId);
    if (!clip) return state;
    
    // クリップ内の相対時間を計算
    const relativeTime = splitTime - clip.startTime;
    
    // 分割位置がクリップの範囲外の場合は何もしない
    if (relativeTime <= 0 || relativeTime >= clip.duration) {
      return state;
    }
    
    // 新しい2つのクリップを作成
    const firstClip: Clip = {
      ...clip,
      id: `${clip.id}-1`,
      duration: relativeTime,
    };
    
    const secondClip: Clip = {
      ...clip,
      id: `${clip.id}-2`,
      startTime: clip.startTime + relativeTime,
      duration: clip.duration - relativeTime,
    };
    
    return {
      tracks: state.tracks.map(t =>
        t.id === trackId
          ? {
              ...t,
              clips: t.clips.flatMap(c =>
                c.id === clipId ? [firstClip, secondClip] : [c]
              ),
            }
          : t
      ),
    };
  }),
  
  deleteSelectedClip: () => set((state) => {
    if (!state.selectedClipId || !state.selectedTrackId) return state;
    
    return {
      tracks: state.tracks.map(track =>
        track.id === state.selectedTrackId
          ? {
              ...track,
              clips: track.clips.filter(c => c.id !== state.selectedClipId),
            }
          : track
      ),
      selectedClipId: null,
      selectedTrackId: null,
    };
  }),
}));
