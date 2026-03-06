import { create } from 'zustand';

export interface ClipEffects {
  brightness: number;  // 0〜2, default 1.0
  contrast: number;    // 0〜2, default 1.0
  saturation: number;  // 0〜2, default 1.0
  rotation: number;    // -180〜180, default 0
  scaleX: number;      // 0.1〜3, default 1.0
  scaleY: number;      // 0.1〜3, default 1.0
  positionX: number;   // -500〜500, default 0
  positionY: number;   // -500〜500, default 0
}

export const DEFAULT_EFFECTS: ClipEffects = {
  brightness: 1.0,
  contrast: 1.0,
  saturation: 1.0,
  rotation: 0,
  scaleX: 1.0,
  scaleY: 1.0,
  positionX: 0,
  positionY: 0,
};

export type TextAnimation = 'none' | 'fadeIn' | 'fadeOut' | 'fadeInOut' | 'slideUp' | 'slideDown';

export interface TextProperties {
  text: string;
  fontSize: number;        // 16〜120, default 32
  fontColor: string;       // hex, default '#ffffff'
  fontFamily: string;      // default 'sans-serif'
  bold: boolean;
  italic: boolean;
  textAlign: 'left' | 'center' | 'right';
  positionX: number;       // 0〜100 (%), default 50
  positionY: number;       // 0〜100 (%), default 85
  opacity: number;         // 0〜1, default 1
  backgroundColor: string; // hex or 'transparent'
  animation: TextAnimation;
  animationDuration: number; // 秒, default 0.3
}

export const DEFAULT_TEXT_PROPERTIES: TextProperties = {
  text: 'テキスト',
  fontSize: 32,
  fontColor: '#ffffff',
  fontFamily: 'sans-serif',
  bold: false,
  italic: false,
  textAlign: 'center',
  positionX: 50,
  positionY: 85,
  opacity: 1,
  backgroundColor: 'transparent',
  animation: 'none',
  animationDuration: 0.3,
};

export type TransitionType =
  | 'crossfade'
  | 'wipe-left'
  | 'wipe-right'
  | 'wipe-up'
  | 'wipe-down'
  | 'dissolve';

export interface ClipTransition {
  type: TransitionType;
  duration: number; // オーバーラップ秒数（前クリップの末尾と当クリップの先頭が重なる）
}

export interface Clip {
  id: string;
  name: string;
  startTime: number; // タイムライン上の開始位置（秒）
  duration: number; // タイムライン上の表示時間（秒）
  color?: string;

  // 動画ファイル情報
  filePath: string; // 動画ファイルのパス
  sourceStartTime: number; // 元動画の開始位置（秒）
  sourceEndTime: number; // 元動画の終了位置（秒）

  // エフェクト
  effects?: ClipEffects;

  // テキストオーバーレイ
  textProperties?: TextProperties;

  // トランジション（前のクリップとの境界に適用）
  transition?: ClipTransition;
}

export interface Track {
  id: string;
  type: 'video' | 'audio' | 'text';
  name: string;
  clips: Clip[];
}

export interface CrossTrackTransition {
  id: string;
  type: TransitionType;
  duration: number;
  sourceTrackId: string;  // 出力元（フェードアウト側）
  sourceClipId: string;
  targetTrackId: string;  // 入力先（フェードイン側）
  targetClipId: string;
}

export interface TimelineState {
  // タイムライン設定
  pixelsPerSecond: number;
  currentTime: number;
  duration: number;
  isPlaying: boolean;

  // トラック
  tracks: Track[];

  // クロストラックトランジション
  crossTrackTransitions: CrossTrackTransition[];

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

  // トランジション
  setTransition: (trackId: string, clipId: string, transition: ClipTransition) => void;
  removeTransition: (trackId: string, clipId: string) => void;

  // クロストラックトランジション
  addCrossTrackTransition: (transition: CrossTrackTransition) => void;
  removeCrossTrackTransition: (transitionId: string) => void;
  updateCrossTrackTransition: (transitionId: string, updates: Partial<Pick<CrossTrackTransition, 'type' | 'duration'>>) => void;

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
  tracks: [],

  // クロストラックトランジション
  crossTrackTransitions: [],

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
  
  removeClip: (trackId, clipId) => set((state) => {
    const tracks = state.tracks
      .map((track) =>
        track.id === trackId
          ? { ...track, clips: track.clips.filter((clip) => clip.id !== clipId) }
          : track
      )
      .filter((track) => track.clips.length > 0);

    const isSelectedClipRemoved = state.selectedTrackId === trackId && state.selectedClipId === clipId;

    return {
      tracks,
      crossTrackTransitions: state.crossTrackTransitions.filter(
        (ct) => ct.sourceClipId !== clipId && ct.targetClipId !== clipId
      ),
      selectedTrackId: isSelectedClipRemoved ? null : state.selectedTrackId,
      selectedClipId: isSelectedClipRemoved ? null : state.selectedClipId,
    };
  }),
  
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
    crossTrackTransitions: state.crossTrackTransitions.filter(
      (ct) => ct.sourceTrackId !== trackId && ct.targetTrackId !== trackId
    ),
  })),
  
  // ズーム
  zoomIn: () => set((state) => ({
    pixelsPerSecond: Math.min(state.pixelsPerSecond * 1.2, 200),
  })),
  
  zoomOut: () => set((state) => ({
    pixelsPerSecond: Math.max(state.pixelsPerSecond / 1.2, 10),
  })),
  
  // トランジション
  setTransition: (trackId, clipId, transition) => set((state) => ({
    tracks: state.tracks.map(track =>
      track.id === trackId
        ? {
            ...track,
            clips: track.clips.map(clip =>
              clip.id === clipId ? { ...clip, transition } : clip
            ),
          }
        : track
    ),
  })),

  removeTransition: (trackId, clipId) => set((state) => ({
    tracks: state.tracks.map(track =>
      track.id === trackId
        ? {
            ...track,
            clips: track.clips.map(clip =>
              clip.id === clipId ? { ...clip, transition: undefined } : clip
            ),
          }
        : track
    ),
  })),

  // クロストラックトランジション
  addCrossTrackTransition: (transition) => set((state) => {
    // バリデーション: 異なるトラックであること
    if (transition.sourceTrackId === transition.targetTrackId) return state;

    // バリデーション: クリップが存在し、時間的に重複していること
    const sourceTrack = state.tracks.find(t => t.id === transition.sourceTrackId);
    const targetTrack = state.tracks.find(t => t.id === transition.targetTrackId);
    if (!sourceTrack || !targetTrack) return state;

    const sourceClip = sourceTrack.clips.find(c => c.id === transition.sourceClipId);
    const targetClip = targetTrack.clips.find(c => c.id === transition.targetClipId);
    if (!sourceClip || !targetClip) return state;

    const sourceEnd = sourceClip.startTime + sourceClip.duration;
    const targetEnd = targetClip.startTime + targetClip.duration;
    if (sourceClip.startTime >= targetEnd || targetClip.startTime >= sourceEnd) return state;

    return {
      crossTrackTransitions: [...state.crossTrackTransitions, transition],
    };
  }),

  removeCrossTrackTransition: (transitionId) => set((state) => ({
    crossTrackTransitions: state.crossTrackTransitions.filter(ct => ct.id !== transitionId),
  })),

  updateCrossTrackTransition: (transitionId, updates) => set((state) => ({
    crossTrackTransitions: state.crossTrackTransitions.map(ct =>
      ct.id === transitionId ? { ...ct, ...updates } : ct
    ),
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
      sourceEndTime: clip.sourceStartTime + relativeTime,
    };
    
    const secondClip: Clip = {
      ...clip,
      id: `${clip.id}-2`,
      startTime: clip.startTime + relativeTime,
      duration: clip.duration - relativeTime,
      sourceStartTime: clip.sourceStartTime + relativeTime,
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
      crossTrackTransitions: state.crossTrackTransitions.filter(
        (ct) => ct.sourceClipId !== clipId && ct.targetClipId !== clipId
      ),
    };
  }),
  
  deleteSelectedClip: () => set((state) => {
    if (!state.selectedClipId || !state.selectedTrackId) return state;

    const clipId = state.selectedClipId;
    return {
      tracks: state.tracks
        .map((track) =>
          track.id === state.selectedTrackId
            ? {
                ...track,
                clips: track.clips.filter((clip) => clip.id !== clipId),
              }
            : track
        )
        .filter((track) => track.clips.length > 0),
      crossTrackTransitions: state.crossTrackTransitions.filter(
        (ct) => ct.sourceClipId !== clipId && ct.targetClipId !== clipId
      ),
      selectedClipId: null,
      selectedTrackId: null,
    };
  }),
}));
