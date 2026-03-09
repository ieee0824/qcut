import { create } from 'zustand';
import type { TimelineState } from './types';
import { createPlaybackSlice } from './playbackSlice';
import { createTrackSlice } from './trackSlice';
import { createClipSlice } from './clipSlice';
import { createHistorySlice } from './historySlice';
import { createClipboardSlice } from './clipboardSlice';

export const useTimelineStore = create<TimelineState>((...args) => ({
  ...createPlaybackSlice(...args),
  ...createTrackSlice(...args),
  ...createClipSlice(...args),
  ...createHistorySlice(...args),
  ...createClipboardSlice(...args),
}));

// Re-export all types and constants
export type {
  ClipEffects,
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
  DEFAULT_TEXT_PROPERTIES,
  DEFAULT_TIMECODE_OVERLAY,
} from './types';
