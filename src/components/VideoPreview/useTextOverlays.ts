import { useCallback, useEffect, useState } from 'react';
import { useTimelineStore } from '../../store/timelineStore';
import type { Clip as ClipType, TextProperties } from '../../store/timelineStore';

interface UseTextOverlaysReturn {
  textOverlays: ClipType[];
  textCurrentTime: number;
  calcTextOpacity: (tp: TextProperties, elapsed: number, clipDuration: number) => number;
  calcTextTranslateY: (tp: TextProperties, elapsed: number, clipDuration: number) => number;
}

export const useTextOverlays = (): UseTextOverlaysReturn => {
  const tracks = useTimelineStore((s) => s.tracks);
  const [textOverlays, setTextOverlays] = useState<ClipType[]>([]);
  const [textCurrentTime, setTextCurrentTime] = useState(0);

  const findTextClipsAtTime = useCallback((time: number): ClipType[] => {
    const currentTracks = useTimelineStore.getState().tracks;
    const results: ClipType[] = [];
    for (const track of currentTracks) {
      if (track.type === 'text') {
        for (const clip of track.clips) {
          if (time >= clip.startTime && time < clip.startTime + clip.duration && clip.textProperties) {
            results.push(clip);
          }
        }
      }
    }
    return results;
  }, []);

  const calcTextOpacity = useCallback((tp: TextProperties, elapsed: number, clipDuration: number): number => {
    const dur = tp.animationDuration;
    let opacity = tp.opacity;
    if (tp.animation === 'fadeIn' || tp.animation === 'fadeInOut') {
      if (elapsed < dur) opacity *= elapsed / dur;
    }
    if (tp.animation === 'fadeOut' || tp.animation === 'fadeInOut') {
      const remaining = clipDuration - elapsed;
      if (remaining < dur) opacity *= remaining / dur;
    }
    return Math.max(0, Math.min(1, opacity));
  }, []);

  const calcTextTranslateY = useCallback((tp: TextProperties, elapsed: number, _clipDuration: number): number => {
    const dur = tp.animationDuration;
    if (tp.animation === 'slideUp') {
      if (elapsed < dur) return 20 * (1 - elapsed / dur);
    }
    if (tp.animation === 'slideDown') {
      if (elapsed < dur) return -20 * (1 - elapsed / dur);
    }
    return 0;
  }, []);

  useEffect(() => {
    const updateTextOverlays = (time: number) => {
      const clips = findTextClipsAtTime(time);
      setTextOverlays(clips);
      setTextCurrentTime(time);
    };
    updateTextOverlays(useTimelineStore.getState().currentTime);
    return useTimelineStore.subscribe((state) => {
      updateTextOverlays(state.currentTime);
    });
  }, [tracks, findTextClipsAtTime]);

  return { textOverlays, textCurrentTime, calcTextOpacity, calcTextTranslateY };
};
