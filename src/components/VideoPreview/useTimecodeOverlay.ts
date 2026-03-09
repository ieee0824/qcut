import { useEffect, useState, useCallback } from 'react';
import { useTimelineStore } from '../../store/timelineStore';
import type { Clip, TimecodeOverlay } from '../../store/timelineStore';
import { DEFAULT_TIMECODE_OVERLAY } from '../../store/timelineStore';
import { formatTimecode } from '../../utils/timecode';

interface TimecodeDisplay {
  text: string;
  overlay: TimecodeOverlay;
}

interface UseTimecodeOverlayReturn {
  timecodeDisplay: TimecodeDisplay | null;
}

export const useTimecodeOverlay = (): UseTimecodeOverlayReturn => {
  const tracks = useTimelineStore((s) => s.tracks);
  const [timecodeDisplay, setTimecodeDisplay] = useState<TimecodeDisplay | null>(null);

  const findVideoClipAtTime = useCallback((time: number): Clip | null => {
    const currentTracks = useTimelineStore.getState().tracks;
    for (const track of currentTracks) {
      if (track.type === 'video') {
        for (const clip of track.clips) {
          if (time >= clip.startTime && time < clip.startTime + clip.duration) {
            return clip;
          }
        }
      }
    }
    return null;
  }, []);

  useEffect(() => {
    const update = (time: number) => {
      const clip = findVideoClipAtTime(time);
      if (!clip) {
        setTimecodeDisplay(null);
        return;
      }

      const overlay = clip.timecodeOverlay ?? DEFAULT_TIMECODE_OVERLAY;
      if (!overlay.enabled) {
        setTimecodeDisplay(null);
        return;
      }

      const elapsed = time - clip.startTime;
      const text = formatTimecode(overlay.startDateTime, elapsed, overlay.format);
      setTimecodeDisplay({ text, overlay });
    };

    update(useTimelineStore.getState().currentTime);
    return useTimelineStore.subscribe((state) => {
      update(state.currentTime);
    });
  }, [tracks, findVideoClipAtTime]);

  return { timecodeDisplay };
};
