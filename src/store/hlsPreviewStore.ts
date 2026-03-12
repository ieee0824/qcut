import { create } from 'zustand';

export interface HlsSegment {
  hlsStart: number;
  timelineStart: number;
  duration: number;
}

/** HLS 時刻 → タイムライン時刻 */
export function hlsToTimeline(hlsTime: number, segments: HlsSegment[]): number {
  for (const seg of segments) {
    if (hlsTime >= seg.hlsStart && hlsTime < seg.hlsStart + seg.duration) {
      return seg.timelineStart + (hlsTime - seg.hlsStart);
    }
  }
  const last = segments[segments.length - 1];
  if (last) return last.timelineStart + last.duration;
  return 0;
}

/** タイムライン時刻 → HLS 時刻 */
export function timelineToHls(timelineTime: number, segments: HlsSegment[]): number {
  for (const seg of segments) {
    if (timelineTime >= seg.timelineStart && timelineTime < seg.timelineStart + seg.duration) {
      return seg.hlsStart + (timelineTime - seg.timelineStart);
    }
  }
  return 0;
}

interface HlsPreviewState {
  hlsPath: string | null;
  hlsSegments: HlsSegment[];
  isGenerating: boolean;
  error: string | null;

  setHlsReady: (path: string, segments: HlsSegment[]) => void;
  setIsGenerating: (generating: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useHlsPreviewStore = create<HlsPreviewState>((set) => ({
  hlsPath: null,
  hlsSegments: [],
  isGenerating: false,
  error: null,

  setHlsReady: (path, segments) =>
    set({ hlsPath: path, hlsSegments: segments, error: null, isGenerating: false }),
  setIsGenerating: (generating) => set({ isGenerating: generating }),
  setError: (error) => set({ error, isGenerating: false }),
  reset: () => set({ hlsPath: null, hlsSegments: [], isGenerating: false, error: null }),
}));
