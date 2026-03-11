import { create } from 'zustand';
import type { TimelineState } from './types';
import { createPlaybackSlice } from './playbackSlice';
import { createTrackSlice } from './trackSlice';
import { createClipSlice } from './clipSlice';
import { createHistorySlice } from './historySlice';
import { createClipboardSlice } from './clipboardSlice';

export const useTimelineStore = create<TimelineState>((set, get) => ({
  ...createPlaybackSlice(set),
  ...createTrackSlice(set),
  ...createClipSlice(set),
  ...createHistorySlice(set, get),
  ...createClipboardSlice(set),
}));

// Re-export all types and constants
export type {
  ClipEffects,
  EasingType,
  Keyframe,
  ClipKeyframes,
  CurvePoint,
  ToneCurves,
  TextAnimation,
  TextProperties,
  TimecodeFormat,
  TimecodeOverlay,
  TransitionType,
  ClipTransition,
  Clip,
  Track,
  TimelineState,
} from './types';

export {
  DEFAULT_EFFECTS,
  DEFAULT_CURVE_POINTS,
  DEFAULT_TONE_CURVES,
  DEFAULT_TEXT_PROPERTIES,
  DEFAULT_TIMECODE_OVERLAY,
} from './types';
