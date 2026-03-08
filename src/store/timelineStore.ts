import { create } from 'zustand';
import { logAction } from './actionLogger';

export interface ClipEffects {
  brightness: number;  // 0〜2, default 1.0
  contrast: number;    // 0〜2, default 1.0
  saturation: number;  // 0〜2, default 1.0
  rotation: number;    // -180〜180, default 0
  scaleX: number;      // 0.1〜3, default 1.0
  scaleY: number;      // 0.1〜3, default 1.0
  positionX: number;   // -500〜500, default 0
  positionY: number;   // -500〜500, default 0
  fadeIn: number;      // 0〜3, default 0 (seconds)
  fadeOut: number;     // 0〜3, default 0 (seconds)
  volume: number;      // 0〜2, default 1.0
  eqLow: number;      // -12〜12 dB, default 0 (100Hz shelf)
  eqMid: number;      // -12〜12 dB, default 0 (1kHz peaking)
  eqHigh: number;     // -12〜12 dB, default 0 (10kHz shelf)
  denoiseAmount: number;  // 0〜1, default 0 (0=オフ, 1=最大)
  highpassFreq: number;   // 0〜500 Hz, default 0 (0=オフ)
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
  fadeIn: 0,
  fadeOut: 0,
  volume: 1.0,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
  denoiseAmount: 0,
  highpassFreq: 0,
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
  volume: number;  // 0〜2, default 1.0（トラック全体のゲイン）
  mute: boolean;
  solo: boolean;
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

  // Undo/Redo 履歴
  _history: Track[][];
  _historyIndex: number;

  // アクション
  setPixelsPerSecond: (pps: number) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  addClip: (trackId: string, clip: Clip) => void;
  removeClip: (trackId: string, clipId: string) => void;
  updateClip: (trackId: string, clipId: string, updates: Partial<Clip>) => void;
  updateClipSilent: (trackId: string, clipId: string, updates: Partial<Clip>) => void;
  commitHistory: () => void;
  addTrack: (track: Omit<Track, 'volume' | 'mute' | 'solo'> & Partial<Pick<Track, 'volume' | 'mute' | 'solo'>>) => void;
  removeTrack: (trackId: string) => void;
  updateTrackVolume: (trackId: string, volume: number) => void;
  toggleMute: (trackId: string) => void;
  toggleSolo: (trackId: string) => void;
  moveClipToTrack: (fromTrackId: string, clipId: string, toTrackId: string) => void;
  zoomIn: () => void;
  zoomOut: () => void;

  // トランジション
  setTransition: (trackId: string, clipId: string, transition: ClipTransition) => void;
  removeTransition: (trackId: string, clipId: string) => void;

  // カット編集機能
  setSelectedClip: (trackId: string | null, clipId: string | null) => void;
  splitClipAtTime: (trackId: string, clipId: string, splitTime: number) => void;
  deleteSelectedClip: () => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // クリップボード
  _clipboard: { trackId: string; trackType: Track['type']; clip: Clip } | null;
  copySelectedClip: () => void;
  pasteClip: () => void;
}

const MAX_HISTORY = 50;

/** Record new tracks into history (call with the NEW tracks state) */
function withHistory(
  state: TimelineState,
  newTracks: Track[],
): Pick<TimelineState, 'tracks' | '_history' | '_historyIndex'> {
  const history = state._history.slice(0, state._historyIndex + 1);
  history.push(JSON.parse(JSON.stringify(newTracks)));
  if (history.length > MAX_HISTORY) history.shift();
  return { tracks: newTracks, _history: history, _historyIndex: history.length - 1 };
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  // タイムライン設定
  pixelsPerSecond: 50,
  currentTime: 0,
  duration: 0,
  isPlaying: false,

  // トラック
  tracks: [],

  // 選択状態
  selectedClipId: null,
  selectedTrackId: null,

  // Undo/Redo 履歴
  _history: [[]],
  _historyIndex: 0,

  // クリップボード
  _clipboard: null,

  // アクション
  setPixelsPerSecond: (pps) => set({ pixelsPerSecond: pps }),

  setCurrentTime: (time) => set({ currentTime: time }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  addClip: (trackId, clip) => set((state) => {
    logAction('addClip', `track=${trackId} clip=${clip.name}`);
    const newTracks = state.tracks.map(track =>
      track.id === trackId
        ? { ...track, clips: [...track.clips, clip] }
        : track
    );
    return withHistory(state, newTracks);
  }),

  removeClip: (trackId, clipId) => set((state) => {
    logAction('removeClip', `track=${trackId} clip=${clipId}`);
    const newTracks = state.tracks
      .map((track) =>
        track.id === trackId
          ? { ...track, clips: track.clips.filter((clip) => clip.id !== clipId) }
          : track
      )
      .filter((track) => track.clips.length > 0);

    const isSelectedClipRemoved = state.selectedTrackId === trackId && state.selectedClipId === clipId;

    return {
      ...withHistory(state, newTracks),
      selectedTrackId: isSelectedClipRemoved ? null : state.selectedTrackId,
      selectedClipId: isSelectedClipRemoved ? null : state.selectedClipId,
    };
  }),

  updateClip: (trackId, clipId, updates) => set((state) => {
    logAction('updateClip', `track=${trackId} clip=${clipId} keys=${Object.keys(updates).join(',')}`);
    const newTracks = state.tracks.map(track =>
      track.id === trackId
        ? {
            ...track,
            clips: track.clips.map(clip =>
              clip.id === clipId ? { ...clip, ...updates } : clip
            ),
          }
        : track
    );
    return withHistory(state, newTracks);
  }),

  updateClipSilent: (trackId, clipId, updates) => set((state) => {
    const newTracks = state.tracks.map(track =>
      track.id === trackId
        ? {
            ...track,
            clips: track.clips.map(clip =>
              clip.id === clipId ? { ...clip, ...updates } : clip
            ),
          }
        : track
    );
    return { tracks: newTracks };
  }),

  commitHistory: () => set((state) => {
    const history = state._history.slice(0, state._historyIndex + 1);
    history.push(JSON.parse(JSON.stringify(state.tracks)));
    if (history.length > MAX_HISTORY) history.shift();
    return { _history: history, _historyIndex: history.length - 1 };
  }),

  addTrack: (track) => set((state) => {
    logAction('addTrack', `id=${track.id} type=${track.type}`);
    const withDefaults: Track = { ...track, volume: track.volume ?? 1.0, mute: track.mute ?? false, solo: track.solo ?? false };
    return withHistory(state, [...state.tracks, withDefaults]);
  }),

  removeTrack: (trackId) => set((state) => {
    logAction('removeTrack', `id=${trackId}`);
    return withHistory(state, state.tracks.filter(t => t.id !== trackId));
  }),

  updateTrackVolume: (trackId, volume) => set((state) => {
    logAction('updateTrackVolume', `track=${trackId} volume=${volume.toFixed(2)}`);
    const newTracks = state.tracks.map(t =>
      t.id === trackId ? { ...t, volume } : t
    );
    return withHistory(state, newTracks);
  }),

  toggleMute: (trackId) => set((state) => {
    const track = state.tracks.find(t => t.id === trackId);
    if (!track) return state;
    logAction('toggleMute', `track=${trackId} mute=${!track.mute}`);
    const newTracks = state.tracks.map(t =>
      t.id === trackId ? { ...t, mute: !t.mute } : t
    );
    return withHistory(state, newTracks);
  }),

  toggleSolo: (trackId) => set((state) => {
    const track = state.tracks.find(t => t.id === trackId);
    if (!track) return state;
    logAction('toggleSolo', `track=${trackId} solo=${!track.solo}`);
    const newTracks = state.tracks.map(t =>
      t.id === trackId ? { ...t, solo: !t.solo } : t
    );
    return withHistory(state, newTracks);
  }),

  moveClipToTrack: (fromTrackId, clipId, toTrackId) => set((state) => {
    if (fromTrackId === toTrackId) return state;
    logAction('moveClipToTrack', `clip=${clipId} from=${fromTrackId} to=${toTrackId}`);
    const fromTrack = state.tracks.find(t => t.id === fromTrackId);
    if (!fromTrack) return state;
    const clip = fromTrack.clips.find(c => c.id === clipId);
    if (!clip) return state;
    const newTracks = state.tracks.map(track => {
      if (track.id === fromTrackId) {
        return { ...track, clips: track.clips.filter(c => c.id !== clipId) };
      }
      if (track.id === toTrackId) {
        return { ...track, clips: [...track.clips, clip] };
      }
      return track;
    });
    return {
      ...withHistory(state, newTracks),
      selectedTrackId: toTrackId,
    };
  }),

  // ズーム
  zoomIn: () => set((state) => ({
    pixelsPerSecond: Math.min(state.pixelsPerSecond * 1.2, 200),
  })),

  zoomOut: () => set((state) => ({
    pixelsPerSecond: Math.max(state.pixelsPerSecond / 1.2, 10),
  })),

  // トランジション
  setTransition: (trackId, clipId, transition) => set((state) => {
    logAction('setTransition', `track=${trackId} clip=${clipId} type=${transition.type}`);
    const newTracks = state.tracks.map(track =>
      track.id === trackId
        ? {
            ...track,
            clips: track.clips.map(clip =>
              clip.id === clipId ? { ...clip, transition } : clip
            ),
          }
        : track
    );
    return withHistory(state, newTracks);
  }),

  removeTransition: (trackId, clipId) => set((state) => {
    logAction('removeTransition', `track=${trackId} clip=${clipId}`);
    const newTracks = state.tracks.map(track =>
      track.id === trackId
        ? {
            ...track,
            clips: track.clips.map(clip =>
              clip.id === clipId ? { ...clip, transition: undefined } : clip
            ),
          }
        : track
    );
    return withHistory(state, newTracks);
  }),

  // カット編集機能
  setSelectedClip: (trackId, clipId) => set({
    selectedTrackId: trackId,
    selectedClipId: clipId,
  }),

  splitClipAtTime: (trackId, clipId, splitTime) => set((state) => {
    logAction('splitClipAtTime', `track=${trackId} clip=${clipId} time=${splitTime.toFixed(2)}`);
    const track = state.tracks.find(t => t.id === trackId);
    if (!track) return state;

    const clip = track.clips.find(c => c.id === clipId);
    if (!clip) return state;

    const relativeTime = splitTime - clip.startTime;

    if (relativeTime <= 0 || relativeTime >= clip.duration) {
      return state;
    }

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

    const newTracks = state.tracks.map(t =>
      t.id === trackId
        ? {
            ...t,
            clips: t.clips.flatMap(c =>
              c.id === clipId ? [firstClip, secondClip] : [c]
            ),
          }
        : t
    );
    return withHistory(state, newTracks);
  }),

  deleteSelectedClip: () => set((state) => {
    if (!state.selectedClipId || !state.selectedTrackId) return state;
    logAction('deleteSelectedClip', `track=${state.selectedTrackId} clip=${state.selectedClipId}`);

    const newTracks = state.tracks
      .map((track) =>
        track.id === state.selectedTrackId
          ? {
              ...track,
              clips: track.clips.filter((clip) => clip.id !== state.selectedClipId),
            }
          : track
      )
      .filter((track) => track.clips.length > 0);

    return {
      ...withHistory(state, newTracks),
      selectedClipId: null,
      selectedTrackId: null,
    };
  }),

  // Undo/Redo
  undo: () => set((state) => {
    if (state._historyIndex <= 0) return state;
    logAction('undo', `index=${state._historyIndex - 1}`);
    const newIndex = state._historyIndex - 1;
    return {
      tracks: JSON.parse(JSON.stringify(state._history[newIndex])),
      _historyIndex: newIndex,
      selectedClipId: null,
      selectedTrackId: null,
    };
  }),

  redo: () => set((state) => {
    if (state._historyIndex >= state._history.length - 1) return state;
    logAction('redo', `index=${state._historyIndex + 1}`);
    const newIndex = state._historyIndex + 1;
    return {
      tracks: JSON.parse(JSON.stringify(state._history[newIndex])),
      _historyIndex: newIndex,
      selectedClipId: null,
      selectedTrackId: null,
    };
  }),

  canUndo: () => get()._historyIndex > 0,
  canRedo: () => {
    const s = get();
    return s._historyIndex < s._history.length - 1;
  },

  // クリップボード
  copySelectedClip: () => set((state) => {
    if (!state.selectedClipId || !state.selectedTrackId) return state;
    logAction('copySelectedClip', `track=${state.selectedTrackId} clip=${state.selectedClipId}`);
    const track = state.tracks.find(t => t.id === state.selectedTrackId);
    const clip = track?.clips.find(c => c.id === state.selectedClipId);
    if (!track || !clip) return state;
    return { _clipboard: { trackId: state.selectedTrackId, trackType: track.type, clip: JSON.parse(JSON.stringify(clip)) } };
  }),

  pasteClip: () => set((state) => {
    if (!state._clipboard) return state;
    logAction('pasteClip', `clip=${state._clipboard.clip.name}`);
    const { clip, trackId: sourceTrackId, trackType: sourceType } = state._clipboard;

    // ペースト先: 選択中トラック → コピー元トラック → 同タイプの最初のトラック
    let resolvedTrackId: string | null = state.selectedTrackId;

    // 選択中トラックがコピー元と異なるタイプならスキップ
    if (resolvedTrackId) {
      const selectedTrack = state.tracks.find(t => t.id === resolvedTrackId);
      if (selectedTrack && selectedTrack.type !== sourceType) {
        resolvedTrackId = null;
      }
    }

    if (!resolvedTrackId) {
      resolvedTrackId = sourceTrackId;
    }

    // コピー元トラックが削除済みの場合、同タイプの最初のトラックにフォールバック
    if (!state.tracks.find(t => t.id === resolvedTrackId)) {
      const fallback = state.tracks.find(t => t.type === sourceType);
      if (!fallback) return state;
      resolvedTrackId = fallback.id;
    }

    const newClip: Clip = {
      ...JSON.parse(JSON.stringify(clip)),
      id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      startTime: state.currentTime,
    };

    const newTracks = state.tracks.map(t =>
      t.id === resolvedTrackId
        ? { ...t, clips: [...t.clips, newClip] }
        : t
    );
    return withHistory(state, newTracks);
  }),
}));
