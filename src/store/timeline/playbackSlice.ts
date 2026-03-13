import type { StoreApi } from 'zustand';
import type { TimelineState } from './types';

type Set = StoreApi<TimelineState>['setState'];

export const createPlaybackSlice = (set: Set) => ({
  pixelsPerSecond: 50,
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  selectedClipId: null as string | null,
  selectedTrackId: null as string | null,

  setPixelsPerSecond: (pps: number) => set({ pixelsPerSecond: pps }),
  setCurrentTime: (time: number) => set({ currentTime: time }),
  setIsPlaying: (playing: boolean) => set({ isPlaying: playing }),

  setSelectedClip: (trackId: string | null, clipId: string | null) => set({
    selectedTrackId: trackId,
    selectedClipId: clipId,
  }),

  snapEnabled: true,
  snapLineTime: null as number | null,

  setSnapEnabled: (enabled: boolean) => set({ snapEnabled: enabled }),
  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),
  setSnapLineTime: (time: number | null) =>
    set((state) =>
      state.snapLineTime === time ? state : { snapLineTime: time },
    ),

  zoomIn: () => set((state) => ({
    pixelsPerSecond: Math.min(state.pixelsPerSecond * 1.2, 200),
  })),

  zoomOut: () => set((state) => ({
    pixelsPerSecond: Math.max(state.pixelsPerSecond / 1.2, 10),
  })),
});
