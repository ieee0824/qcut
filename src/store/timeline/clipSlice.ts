import type { StoreApi } from 'zustand';
import { logAction } from '../actionLogger';
import type { TimelineState, Clip, ClipTransition, ClipEffects, Keyframe, EasingType } from './types';
import { withHistory } from './historySlice';

type Set = StoreApi<TimelineState>['setState'];

export const createClipSlice = (set: Set) => ({
  addClip: (trackId: string, clip: Clip) => set((state) => {
    logAction('addClip', `track=${trackId} clip=${clip.name}`);
    const newTracks = state.tracks.map(track =>
      track.id === trackId
        ? { ...track, clips: [...track.clips, clip] }
        : track
    );
    return withHistory(state, newTracks);
  }),

  removeClip: (trackId: string, clipId: string) => set((state) => {
    logAction('removeClip', `track=${trackId} clip=${clipId}`);
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
  }),

  updateClip: (trackId: string, clipId: string, updates: Partial<Clip>) => set((state) => {
    logAction('updateClip', `track=${trackId} clip=${clipId} keys=${Object.keys(updates).join(',')}`);
    const newTracks = state.tracks.map(track =>
      track.id === trackId
        ? {
            ...track,
            clips: track.clips.map(clip =>
              clip.id === clipId ? { ...clip, ...updates } : clip
            ),
          }
        : track
    );
    return withHistory(state, newTracks);
  }),

  updateClipSilent: (trackId: string, clipId: string, updates: Partial<Clip>) => set((state) => {
    const newTracks = state.tracks.map(track =>
      track.id === trackId
        ? {
            ...track,
            clips: track.clips.map(clip =>
              clip.id === clipId ? { ...clip, ...updates } : clip
            ),
          }
        : track
    );
    return { tracks: newTracks };
  }),

  splitClipAtTime: (trackId: string, clipId: string, splitTime: number) => set((state) => {
    logAction('splitClipAtTime', `track=${trackId} clip=${clipId} time=${splitTime.toFixed(2)}`);
    const track = state.tracks.find(t => t.id === trackId);
    if (!track) return state;

    const clip = track.clips.find(c => c.id === clipId);
    if (!clip) return state;

    const relativeTime = splitTime - clip.startTime;

    if (relativeTime <= 0 || relativeTime >= clip.duration) {
      return state;
    }

    const firstClip: Clip = {
      ...clip,
      id: `${clip.id}-1`,
      duration: relativeTime,
      sourceEndTime: clip.sourceStartTime + relativeTime,
    };

    const secondClip: Clip = {
      ...clip,
      id: `${clip.id}-2`,
      startTime: clip.startTime + relativeTime,
      duration: clip.duration - relativeTime,
      sourceStartTime: clip.sourceStartTime + relativeTime,
    };

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
  }),

  deleteSelectedClip: () => set((state) => {
    if (!state.selectedClipId || !state.selectedTrackId) return state;
    logAction('deleteSelectedClip', `track=${state.selectedTrackId} clip=${state.selectedClipId}`);

    const newTracks = state.tracks
      .map((track) =>
        track.id === state.selectedTrackId
          ? {
              ...track,
              clips: track.clips.filter((clip) => clip.id !== state.selectedClipId),
            }
          : track
      )
      .filter((track) => track.clips.length > 0);

    return {
      ...withHistory(state, newTracks),
      selectedClipId: null,
      selectedTrackId: null,
    };
  }),

  setTransition: (trackId: string, clipId: string, transition: ClipTransition) => set((state) => {
    logAction('setTransition', `track=${trackId} clip=${clipId} type=${transition.type}`);
    const newTracks = state.tracks.map(track =>
      track.id === trackId
        ? {
            ...track,
            clips: track.clips.map(clip =>
              clip.id === clipId ? { ...clip, transition } : clip
            ),
          }
        : track
    );
    return withHistory(state, newTracks);
  }),

  removeTransition: (trackId: string, clipId: string) => set((state) => {
    logAction('removeTransition', `track=${trackId} clip=${clipId}`);
    const newTracks = state.tracks.map(track =>
      track.id === trackId
        ? {
            ...track,
            clips: track.clips.map(clip =>
              clip.id === clipId ? { ...clip, transition: undefined } : clip
            ),
          }
        : track
    );
    return withHistory(state, newTracks);
  }),

  addKeyframe: (trackId: string, clipId: string, effectKey: keyof ClipEffects, keyframe: Keyframe) => set((state) => {
    logAction('addKeyframe', `track=${trackId} clip=${clipId} key=${effectKey} time=${keyframe.time.toFixed(2)}`);
    const newTracks = state.tracks.map(track =>
      track.id === trackId
        ? {
            ...track,
            clips: track.clips.map(clip => {
              if (clip.id !== clipId) return clip;
              const existing = clip.keyframes?.[effectKey] ?? [];
              // 同じ time のキーフレームは上書き
              const filtered = existing.filter(kf => Math.abs(kf.time - keyframe.time) > 0.001);
              const updated = [...filtered, keyframe].sort((a, b) => a.time - b.time);
              return {
                ...clip,
                keyframes: { ...clip.keyframes, [effectKey]: updated },
              };
            }),
          }
        : track
    );
    return withHistory(state, newTracks);
  }),

  removeKeyframe: (trackId: string, clipId: string, effectKey: keyof ClipEffects, time: number) => set((state) => {
    logAction('removeKeyframe', `track=${trackId} clip=${clipId} key=${effectKey} time=${time.toFixed(2)}`);
    const newTracks = state.tracks.map(track =>
      track.id === trackId
        ? {
            ...track,
            clips: track.clips.map(clip => {
              if (clip.id !== clipId) return clip;
              const existing = clip.keyframes?.[effectKey] ?? [];
              const updated = existing.filter(kf => Math.abs(kf.time - time) > 0.001);
              const newKeyframes = { ...clip.keyframes, [effectKey]: updated };
              if (updated.length === 0) delete newKeyframes[effectKey];
              return { ...clip, keyframes: newKeyframes };
            }),
          }
        : track
    );
    return withHistory(state, newTracks);
  }),

  updateKeyframeEasing: (trackId: string, clipId: string, effectKey: keyof ClipEffects, time: number, easing: EasingType) => set((state) => {
    const newTracks = state.tracks.map(track =>
      track.id === trackId
        ? {
            ...track,
            clips: track.clips.map(clip => {
              if (clip.id !== clipId) return clip;
              const existing = clip.keyframes?.[effectKey] ?? [];
              const updated = existing.map(kf =>
                Math.abs(kf.time - time) <= 0.001 ? { ...kf, easing } : kf
              );
              return { ...clip, keyframes: { ...clip.keyframes, [effectKey]: updated } };
            }),
          }
        : track
    );
    return withHistory(state, newTracks);
  }),

  moveClipToTrack: (fromTrackId: string, clipId: string, toTrackId: string) => set((state) => {
    if (fromTrackId === toTrackId) return state;
    logAction('moveClipToTrack', `clip=${clipId} from=${fromTrackId} to=${toTrackId}`);
    const fromTrack = state.tracks.find(t => t.id === fromTrackId);
    if (!fromTrack) return state;
    const clip = fromTrack.clips.find(c => c.id === clipId);
    if (!clip) return state;
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
  }),
});
