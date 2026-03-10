export interface ClipEffects {
  brightness: number;  // 0〜2, default 1.0
  contrast: number;    // 0〜2, default 1.0
  saturation: number;  // 0〜2, default 1.0
  colorTemperature: number;  // -1〜1, default 0 (negative=cool, positive=warm)
  hue: number;               // -180〜180, default 0
  hslRedSat: number;         // -1〜1, default 0 (色域別彩度: 赤)
  hslYellowSat: number;      // -1〜1, default 0 (色域別彩度: 黄)
  hslGreenSat: number;       // -1〜1, default 0 (色域別彩度: 緑)
  hslCyanSat: number;        // -1〜1, default 0 (色域別彩度: シアン)
  hslBlueSat: number;        // -1〜1, default 0 (色域別彩度: 青)
  hslMagentaSat: number;     // -1〜1, default 0 (色域別彩度: マゼンタ)
  liftR: number;             // -1〜1, default 0 (リフト: シャドウ赤)
  liftG: number;             // -1〜1, default 0 (リフト: シャドウ緑)
  liftB: number;             // -1〜1, default 0 (リフト: シャドウ青)
  gammaR: number;            // -1〜1, default 0 (ガンマ: ミッドトーン赤)
  gammaG: number;            // -1〜1, default 0 (ガンマ: ミッドトーン緑)
  gammaB: number;            // -1〜1, default 0 (ガンマ: ミッドトーン青)
  gainR: number;             // -1〜1, default 0 (ゲイン: ハイライト赤)
  gainG: number;             // -1〜1, default 0 (ゲイン: ハイライト緑)
  gainB: number;             // -1〜1, default 0 (ゲイン: ハイライト青)
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
  echoDelay: number;      // 0〜1000 ms, default 0 (0=オフ)
  echoDecay: number;      // 0〜0.9, default 0.3
  reverbAmount: number;   // 0〜1, default 0 (0=オフ)
  blurAmount: number;     // 0〜20, default 0 (0=オフ)
  sharpenAmount: number;  // 0〜5, default 0 (0=オフ)
  monochrome: number;     // 0〜1, default 0 (0=オフ, 1=完全モノクロ)
}

export const DEFAULT_EFFECTS: ClipEffects = {
  brightness: 1.0,
  contrast: 1.0,
  saturation: 1.0,
  colorTemperature: 0,
  hue: 0,
  hslRedSat: 0,
  hslYellowSat: 0,
  hslGreenSat: 0,
  hslCyanSat: 0,
  hslBlueSat: 0,
  hslMagentaSat: 0,
  liftR: 0,
  liftG: 0,
  liftB: 0,
  gammaR: 0,
  gammaG: 0,
  gammaB: 0,
  gainR: 0,
  gainG: 0,
  gainB: 0,
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
  echoDelay: 0,
  echoDecay: 0.3,
  reverbAmount: 0,
  blurAmount: 0,
  sharpenAmount: 0,
  monochrome: 0,
};

// --- Keyframe types ---

export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

export interface Keyframe {
  time: number;       // クリップ先頭からの秒数 (0 〜 clip.duration)
  value: number;
  easing: EasingType; // このキーフレームから次への補間方式
}

export type ClipKeyframes = Partial<Record<keyof ClipEffects, Keyframe[]>>;

// --- Text types ---

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

export type TimecodeFormat = 'ymd-hm' | 'md-hm' | 'hms' | 'hm';

export interface TimecodeOverlay {
  enabled: boolean;
  startDateTime: number;       // epoch milliseconds (開始日時)
  format: TimecodeFormat;
  positionX: number;           // 0〜100 (%), default 50
  positionY: number;           // 0〜100 (%), default 10
  fontSize: number;            // 16〜120, default 24
  fontColor: string;           // hex, default '#ffffff'
}

export const DEFAULT_TIMECODE_OVERLAY: TimecodeOverlay = {
  enabled: false,
  startDateTime: Date.now(),
  format: 'hm',
  positionX: 50,
  positionY: 10,
  fontSize: 24,
  fontColor: '#ffffff',
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

  // キーフレームアニメーション
  keyframes?: ClipKeyframes;

  // テキストオーバーレイ
  textProperties?: TextProperties;

  // トランジション（前のクリップとの境界に適用）
  transition?: ClipTransition;

  // タイムコードオーバーレイ
  timecodeOverlay?: TimecodeOverlay;
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

// --- Slice interfaces ---

export interface PlaybackSlice {
  pixelsPerSecond: number;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  selectedClipId: string | null;
  selectedTrackId: string | null;
  setPixelsPerSecond: (pps: number) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setSelectedClip: (trackId: string | null, clipId: string | null) => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

export interface TrackSlice {
  tracks: Track[];
  addTrack: (track: Omit<Track, 'volume' | 'mute' | 'solo'> & Partial<Pick<Track, 'volume' | 'mute' | 'solo'>>) => void;
  removeTrack: (trackId: string) => void;
  updateTrackVolume: (trackId: string, volume: number) => void;
  toggleMute: (trackId: string) => void;
  toggleSolo: (trackId: string) => void;
}

export interface ClipSlice {
  addClip: (trackId: string, clip: Clip) => void;
  removeClip: (trackId: string, clipId: string) => void;
  updateClip: (trackId: string, clipId: string, updates: Partial<Clip>) => void;
  updateClipSilent: (trackId: string, clipId: string, updates: Partial<Clip>) => void;
  splitClipAtTime: (trackId: string, clipId: string, splitTime: number) => void;
  deleteSelectedClip: () => void;
  setTransition: (trackId: string, clipId: string, transition: ClipTransition) => void;
  removeTransition: (trackId: string, clipId: string) => void;
  moveClipToTrack: (fromTrackId: string, clipId: string, toTrackId: string) => void;
  addKeyframe: (trackId: string, clipId: string, effectKey: keyof ClipEffects, keyframe: Keyframe) => void;
  removeKeyframe: (trackId: string, clipId: string, effectKey: keyof ClipEffects, time: number) => void;
  updateKeyframeEasing: (trackId: string, clipId: string, effectKey: keyof ClipEffects, time: number, easing: EasingType) => void;
  moveKeyframes: (trackId: string, clipId: string, fromTime: number, toTime: number) => void;
  deleteKeyframesAtTime: (trackId: string, clipId: string, time: number) => void;
}

export interface HistorySlice {
  _history: Track[][];
  _historyIndex: number;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  commitHistory: () => void;
}

export interface ClipboardSlice {
  _clipboard: { trackId: string; trackType: Track['type']; clip: Clip } | null;
  copySelectedClip: () => void;
  pasteClip: () => void;
}

export type TimelineState = PlaybackSlice & TrackSlice & ClipSlice & HistorySlice & ClipboardSlice;
