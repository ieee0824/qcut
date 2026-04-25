import type { StoreApi } from 'zustand';
import { logAction } from '../actionLogger';
import type { TimelineState, Clip, ClipTransition, ClipEffects, Keyframe, EasingType, ToneCurveKeyframe } from './types';
import { withHistory } from './historySlice';
import {
  splitClip,
  upsertKeyframe,
  removeKeyframeAtTime,
  updateKeyframeEasingAtTime,
  moveKeyframeTime,
  mapClipKeyframes,
  compactClipKeyframes,
  updateClipInTracks,
} from '../../utils/clipOperations';

type Set = StoreApi<TimelineState>['setState'];
type Get = StoreApi<TimelineState>['getState'];

export const createClipSlice = (set: Set, get: Get) => ({
  addClip: (trackId: string, clip: Clip) => {
    logAction('addClip', `track=${trackId} clip=${clip.name}`);
    set((state) => {
      const newTracks = state.tracks.map(track =>
        track.id === trackId
          ? { ...track, clips: [...track.clips, clip] }
          : track
      );
      return withHistory(state, newTracks);
    });
  },

  removeClip: (trackId: string, clipId: string) => {
    logAction('removeClip', `track=${trackId} clip=${clipId}`);
    set((state) => {
      const newTracks = state.tracks
        .map((track) =>
          track.id === trackId
            ? { ...track, clips: track.clips.filter((clip) => clip.id !== clipId) }
            : track
        )
        .filter((track) => track.clips.length > 0);

      const isSelectedClipRemoved = state.selectedTrackId === trackId && state.selectedClipId === clipId;

      return {
        ...withHistory(state, newTracks),
        selectedTrackId: isSelectedClipRemoved ? null : state.selectedTrackId,
        selectedClipId: isSelectedClipRemoved ? null : state.selectedClipId,
      };
    });
  },

  updateClip: (trackId: string, clipId: string, updates: Partial<Clip>) => {
    logAction('updateClip', `track=${trackId} clip=${clipId} keys=${Object.keys(updates).join(',')}`);
    set((state) => {
      const newTracks = updateClipInTracks(state.tracks, trackId, clipId, clip => ({ ...clip, ...updates }));
      return withHistory(state, newTracks);
    });
  },

  updateClipSilent: (trackId: string, clipId: string, updates: Partial<Clip>) => set((state) => ({
    tracks: updateClipInTracks(state.tracks, trackId, clipId, clip => ({ ...clip, ...updates })),
  })),

  splitClipAtTime: (trackId: string, clipId: string, splitTime: number) => {
    const track = get().tracks.find(t => t.id === trackId);
    if (!track) return;

    const clip = track.clips.find(c => c.id === clipId);
    if (!clip) return;

    const result = splitClip(clip, splitTime);
    if (!result) return;
    logAction('splitClipAtTime', `track=${trackId} clip=${clipId} time=${splitTime.toFixed(2)}`);

    const [firstClip, secondClip] = result;

    set((state) => {
      const newTracks = state.tracks.map(t =>
        t.id === trackId
          ? {
              ...t,
              clips: t.clips.flatMap(c =>
                c.id === clipId ? [firstClip, secondClip] : [c]
              ),
            }
          : t
      );
      return withHistory(state, newTracks);
    });
  },

  deleteSelectedClip: () => {
    const { selectedClipId, selectedTrackId } = get();
    if (!selectedClipId || !selectedTrackId) return;
    logAction('deleteSelectedClip', `track=${selectedTrackId} clip=${selectedClipId}`);
    set((state) => {
      const newTracks = state.tracks
        .map((track) =>
          track.id === selectedTrackId
            ? {
                ...track,
                clips: track.clips.filter((clip) => clip.id !== selectedClipId),
              }
            : track
        )
        .filter((track) => track.clips.length > 0);

      return {
        ...withHistory(state, newTracks),
        selectedClipId: null,
        selectedTrackId: null,
      };
    });
  },

  setTransition: (trackId: string, clipId: string, transition: ClipTransition) => {
    logAction('setTransition', `track=${trackId} clip=${clipId} type=${transition.type}`);
    set((state) => {
      const newTracks = updateClipInTracks(state.tracks, trackId, clipId, clip => ({ ...clip, transition }));
      return withHistory(state, newTracks);
    });
  },

  removeTransition: (trackId: string, clipId: string) => {
    logAction('removeTransition', `track=${trackId} clip=${clipId}`);
    set((state) => {
      const newTracks = updateClipInTracks(state.tracks, trackId, clipId, clip => ({ ...clip, transition: undefined }));
      return withHistory(state, newTracks);
    });
  },

  addKeyframe: (trackId: string, clipId: string, effectKey: keyof ClipEffects, keyframe: Keyframe) => {
    logAction('addKeyframe', `track=${trackId} clip=${clipId} key=${effectKey} time=${keyframe.time.toFixed(2)}`);
    set((state) => {
      const newTracks = updateClipInTracks(state.tracks, trackId, clipId, clip => {
        const existing = clip.keyframes?.[effectKey] ?? [];
        const updated = upsertKeyframe(existing, keyframe);
        return { ...clip, keyframes: { ...clip.keyframes, [effectKey]: updated } };
      });
      return withHistory(state, newTracks);
    });
  },

  removeKeyframe: (trackId: string, clipId: string, effectKey: keyof ClipEffects, time: number) => {
    logAction('removeKeyframe', `track=${trackId} clip=${clipId} key=${effectKey} time=${time.toFixed(2)}`);
    set((state) => {
      const newTracks = updateClipInTracks(state.tracks, trackId, clipId, clip => {
        const existing = clip.keyframes?.[effectKey] ?? [];
        const updated = removeKeyframeAtTime(existing, time);
        const newKeyframes = { ...clip.keyframes, [effectKey]: updated };
        if (updated.length === 0) delete newKeyframes[effectKey];
        const hasKeys = Object.keys(newKeyframes).length > 0;
        return { ...clip, keyframes: hasKeys ? newKeyframes : undefined };
      });
      return withHistory(state, newTracks);
    });
  },

  updateKeyframeEasing: (trackId: string, clipId: string, effectKey: keyof ClipEffects, time: number, easing: EasingType) => {
    logAction('updateKeyframeEasing', `track=${trackId} clip=${clipId} key=${effectKey} time=${time.toFixed(2)} easing=${easing}`);
    set((state) => {
      const newTracks = updateClipInTracks(state.tracks, trackId, clipId, clip => {
        const existing = clip.keyframes?.[effectKey] ?? [];
        const updated = updateKeyframeEasingAtTime(existing, time, easing);
        return { ...clip, keyframes: { ...clip.keyframes, [effectKey]: updated } };
      });
      return withHistory(state, newTracks);
    });
  },

  moveKeyframes: (trackId: string, clipId: string, fromTime: number, toTime: number) => {
    logAction('moveKeyframes', `track=${trackId} clip=${clipId} from=${fromTime.toFixed(2)} to=${toTime.toFixed(2)}`);
    set((state) => {
      const newTracks = updateClipInTracks(state.tracks, trackId, clipId, clip => {
        if (!clip.keyframes) return clip;
        return { ...clip, keyframes: mapClipKeyframes(clip.keyframes, kfs => moveKeyframeTime(kfs, fromTime, toTime)) };
      });
      return withHistory(state, newTracks);
    });
  },

  deleteKeyframesAtTime: (trackId: string, clipId: string, time: number) => {
    logAction('deleteKeyframesAtTime', `track=${trackId} clip=${clipId} time=${time.toFixed(2)}`);
    set((state) => {
      const newTracks = updateClipInTracks(state.tracks, trackId, clipId, clip => {
        if (!clip.keyframes) return clip;
        return { ...clip, keyframes: compactClipKeyframes(clip.keyframes, kfs => removeKeyframeAtTime(kfs, time)) };
      });
      return withHistory(state, newTracks);
    });
  },

  addToneCurveKeyframe: (trackId: string, clipId: string, keyframe: ToneCurveKeyframe) => {
    logAction('addToneCurveKeyframe', `track=${trackId} clip=${clipId} time=${keyframe.time.toFixed(2)}`);
    set((state) => {
      const newTracks = updateClipInTracks(state.tracks, trackId, clipId, clip => {
        const existing = clip.toneCurveKeyframes ?? [];
        return { ...clip, toneCurveKeyframes: upsertKeyframe(existing, keyframe) };
      });
      return withHistory(state, newTracks);
    });
  },

  removeToneCurveKeyframe: (trackId: string, clipId: string, time: number) => {
    logAction('removeToneCurveKeyframe', `track=${trackId} clip=${clipId} time=${time.toFixed(2)}`);
    set((state) => {
      const newTracks = updateClipInTracks(state.tracks, trackId, clipId, clip => {
        const existing = clip.toneCurveKeyframes ?? [];
        const updated = removeKeyframeAtTime(existing, time);
        return { ...clip, toneCurveKeyframes: updated.length > 0 ? updated : undefined };
      });
      return withHistory(state, newTracks);
    });
  },

  updateToneCurveKeyframeEasing: (trackId: string, clipId: string, time: number, easing: EasingType) => {
    logAction('updateToneCurveKeyframeEasing', `track=${trackId} clip=${clipId} time=${time.toFixed(2)} easing=${easing}`);
    set((state) => {
      const newTracks = updateClipInTracks(state.tracks, trackId, clipId, clip => {
        const existing = clip.toneCurveKeyframes ?? [];
        return { ...clip, toneCurveKeyframes: updateKeyframeEasingAtTime(existing, time, easing) };
      });
      return withHistory(state, newTracks);
    });
  },

  moveClipToTrack: (fromTrackId: string, clipId: string, toTrackId: string) => {
    if (fromTrackId === toTrackId) return;
    const fromTrack = get().tracks.find(t => t.id === fromTrackId);
    if (!fromTrack) return;
    const clip = fromTrack.clips.find(c => c.id === clipId);
    if (!clip) return;
    logAction('moveClipToTrack', `clip=${clipId} from=${fromTrackId} to=${toTrackId}`);
    set((state) => {
      const newTracks = state.tracks.map(track => {
        if (track.id === fromTrackId) {
          return { ...track, clips: track.clips.filter(c => c.id !== clipId) };
        }
        if (track.id === toTrackId) {
          return { ...track, clips: [...track.clips, clip] };
        }
        return track;
      });
      return {
        ...withHistory(state, newTracks),
        selectedTrackId: toTrackId,
      };
    });
  },
});
