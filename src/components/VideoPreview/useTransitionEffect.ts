import type React from 'react';
import { useCallback, useRef } from 'react';
import { useTimelineStore } from '../../store/timelineStore';
import type { Clip as ClipType, TransitionType } from '../../store/timelineStore';

export interface TransitionInfo {
  outgoingClip: ClipType;
  incomingClip: ClipType;
  progress: number; // 0→1 (0=outgoing only, 1=incoming only)
  transitionType: TransitionType;
  duration: number;
}

interface UseTransitionEffectParams {
  findClipAtTime: (time: number) => ClipType | null;
}

interface UseTransitionEffectReturn {
  transitionVideoRef: React.RefObject<HTMLVideoElement | null>;
  loadedTransitionVideoUrl: React.MutableRefObject<string | null>;
  isLoadingTransitionVideoRef: React.MutableRefObject<boolean>;
  isInTransitionRef: React.MutableRefObject<boolean>;
  findTransitionAtTime: (time: number) => TransitionInfo | null;
  getTransitionStyles: (
    progress: number,
    type: TransitionType,
  ) => { outgoing: React.CSSProperties; incoming: React.CSSProperties };
  switchTransitionVideo: (url: string, sourceTime: number) => void;
}

export const useTransitionEffect = ({
  findClipAtTime,
}: UseTransitionEffectParams): UseTransitionEffectReturn => {
  const transitionVideoRef = useRef<HTMLVideoElement>(null);
  const loadedTransitionVideoUrl = useRef<string | null>(null);
  const isLoadingTransitionVideoRef = useRef(false);
  const isInTransitionRef = useRef(false);

  const findTransitionAtTime = useCallback(
    (time: number): TransitionInfo | null => {
      const { tracks, transitions } = useTimelineStore.getState();
      for (const transition of transitions) {
        const incomingClip = tracks
          .find((track) => track.id === transition.inTrackId)
          ?.clips.find((clip) => clip.id === transition.inClipId);
        if (!incomingClip) continue;

        const overlapStart = incomingClip.startTime - transition.duration;
        const overlapEnd = incomingClip.startTime;
        if (time >= overlapStart && time < overlapEnd) {
          const outgoing = findClipAtTime(time);
          if (!outgoing || outgoing.id === incomingClip.id) continue;
          const progress = (time - overlapStart) / transition.duration;
          return {
            outgoingClip: outgoing,
            incomingClip,
            progress,
            transitionType: transition.type,
            duration: transition.duration,
          };
        }
      }
      return null;
    },
    [findClipAtTime],
  );

  const getTransitionStyles = useCallback(
    (
      progress: number,
      type: TransitionType,
    ): { outgoing: React.CSSProperties; incoming: React.CSSProperties } => {
      switch (type) {
        case 'crossfade':
        case 'dissolve':
          return {
            outgoing: { opacity: 1 - progress },
            incoming: { opacity: progress },
          };
        case 'wipe-left':
          return {
            outgoing: {},
            incoming: { clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` },
          };
        case 'wipe-right':
          return {
            outgoing: {},
            incoming: { clipPath: `inset(0 0 0 ${(1 - progress) * 100}%)` },
          };
        case 'wipe-up':
          return {
            outgoing: {},
            incoming: { clipPath: `inset(0 0 ${(1 - progress) * 100}% 0)` },
          };
        case 'wipe-down':
          return {
            outgoing: {},
            incoming: { clipPath: `inset(${(1 - progress) * 100}% 0 0 0)` },
          };
        default:
          return {
            outgoing: { opacity: 1 - progress },
            incoming: { opacity: progress },
          };
      }
    },
    [],
  );

  const switchTransitionVideo = useCallback((url: string, sourceTime: number) => {
    if (!transitionVideoRef.current) return;
    if (url === loadedTransitionVideoUrl.current) {
      transitionVideoRef.current.currentTime = sourceTime;
      if (transitionVideoRef.current.paused) {
        transitionVideoRef.current.play();
      }
      return;
    }
    isLoadingTransitionVideoRef.current = true;
    loadedTransitionVideoUrl.current = url;
    transitionVideoRef.current.src = url;
    transitionVideoRef.current.load();
    const videoEl = transitionVideoRef.current;
    videoEl.addEventListener(
      'loadedmetadata',
      () => {
        isLoadingTransitionVideoRef.current = false;
        videoEl.currentTime = sourceTime;
        videoEl.play();
      },
      { once: true },
    );
  }, []);

  return {
    transitionVideoRef,
    loadedTransitionVideoUrl,
    isLoadingTransitionVideoRef,
    isInTransitionRef,
    findTransitionAtTime,
    getTransitionStyles,
    switchTransitionVideo,
  };
};
