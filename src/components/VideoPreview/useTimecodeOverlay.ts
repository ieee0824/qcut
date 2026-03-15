import { useEffect, useState, useCallback, useRef } from 'react';
import { useTimelineStore } from '../../store/timelineStore';
import type { Clip, TimecodeOverlay } from '../../store/timelineStore';
import { DEFAULT_TIMECODE_OVERLAY } from '../../store/timelineStore';
import { formatTimecode } from '../../utils/timecode';

interface TimecodeDisplay {
  text: string;
  overlay: TimecodeOverlay;
  clipId: string;
  trackId: string;
}

interface UseTimecodeOverlayReturn {
  timecodeDisplay: TimecodeDisplay | null;
  isDragging: boolean;
  handlePointerDown: (e: React.PointerEvent) => void;
  handlePointerMove: (e: React.PointerEvent) => void;
  handlePointerUp: () => void;
}

export const useTimecodeOverlay = (
  overlayFrameRef: React.RefObject<HTMLDivElement | null>,
): UseTimecodeOverlayReturn => {
  const tracks = useTimelineStore((s) => s.tracks);
  const [timecodeDisplay, setTimecodeDisplay] = useState<TimecodeDisplay | null>(null);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const findVideoClipAtTime = useCallback((time: number): { clip: Clip; trackId: string } | null => {
    const currentTracks = useTimelineStore.getState().tracks;
    for (const track of currentTracks) {
      if (track.type === 'video') {
        for (const clip of track.clips) {
          if (time >= clip.startTime && time < clip.startTime + clip.duration) {
            return { clip, trackId: track.id };
          }
        }
      }
    }
    return null;
  }, []);

  useEffect(() => {
    const update = (time: number) => {
      const result = findVideoClipAtTime(time);
      if (!result) {
        setTimecodeDisplay(null);
        return;
      }

      const overlay = result.clip.timecodeOverlay ?? DEFAULT_TIMECODE_OVERLAY;
      if (!overlay.enabled) {
        setTimecodeDisplay(null);
        return;
      }

      const elapsed = time - result.clip.startTime;
      const text = formatTimecode(overlay.startDateTime, elapsed, overlay.format);
      setTimecodeDisplay({ text, overlay, clipId: result.clip.id, trackId: result.trackId });
    };

    update(useTimelineStore.getState().currentTime);
    return useTimelineStore.subscribe((state) => {
      update(state.currentTime);
    });
  }, [tracks, findVideoClipAtTime]);

  const calcPosition = useCallback((e: React.PointerEvent): { x: number; y: number } | null => {
    const overlayFrame = overlayFrameRef.current;
    if (!overlayFrame) return null;
    const rect = overlayFrame.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    return { x, y };
  }, [overlayFrameRef]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    setIsDragging(true);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current || !timecodeDisplay) return;
    const pos = calcPosition(e);
    if (!pos) return;

    const { updateClipSilent } = useTimelineStore.getState();
    const currentOverlay = timecodeDisplay.overlay;
    updateClipSilent(timecodeDisplay.trackId, timecodeDisplay.clipId, {
      timecodeOverlay: { ...currentOverlay, positionX: Math.round(pos.x), positionY: Math.round(pos.y) },
    });
  }, [timecodeDisplay, calcPosition]);

  const handlePointerUp = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      const { commitHistory } = useTimelineStore.getState();
      commitHistory();
    }
  }, []);

  return { timecodeDisplay, isDragging, handlePointerDown, handlePointerMove, handlePointerUp };
};
