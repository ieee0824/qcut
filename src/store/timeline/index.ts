import { create } from 'zustand';
import type { TimelineState } from './types';
import { createPlaybackSlice } from './playbackSlice';
import { createTrackSlice } from './trackSlice';
import { createTransitionSlice } from './transitionSlice';
import { createClipSlice } from './clipSlice';
import { createHistorySlice } from './historySlice';
import { createClipboardSlice } from './clipboardSlice';

export const useTimelineStore = create<TimelineState>((set, get) => ({
  ...createPlaybackSlice(set),
  ...createTrackSlice(set),
  ...createTransitionSlice(set, get),
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
  ToneCurveKeyframe,
  CurvePoint,
  ToneCurves,
  TextAnimation,
  TextProperties,
  TimecodeFormat,
  TimecodeOverlay,
  TransitionType,
  ClipTransition,
  TimelineTransition,
  Clip,
  Track,
  TimelineHistoryEntry,
  TimelineState,
} from './types';

export {
  DEFAULT_EFFECTS,
  DEFAULT_CURVE_POINTS,
  DEFAULT_TONE_CURVES,
  DEFAULT_TEXT_PROPERTIES,
  DEFAULT_TIMECODE_OVERLAY,
} from './types';
