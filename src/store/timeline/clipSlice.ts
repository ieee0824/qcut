import type { StoreApi } from 'zustand';
import { logAction } from '../actionLogger';
import type { TimelineState, Clip, ClipEffects, Keyframe, EasingType, ToneCurveKeyframe } from './types';
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
              const hasKeys = Object.keys(newKeyframes).length > 0;
              return { ...clip, keyframes: hasKeys ? newKeyframes : undefined };
            }),
          }
        : track
    );
    return withHistory(state, newTracks);
  }),

  updateKeyframeEasing: (trackId: string, clipId: string, effectKey: keyof ClipEffects, time: number, easing: EasingType) => set((state) => {
    logAction('updateKeyframeEasing', `track=${trackId} clip=${clipId} key=${effectKey} time=${time.toFixed(2)} easing=${easing}`);
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

  moveKeyframes: (trackId: string, clipId: string, fromTime: number, toTime: number) => set((state) => {
    logAction('moveKeyframes', `track=${trackId} clip=${clipId} from=${fromTime.toFixed(2)} to=${toTime.toFixed(2)}`);
    const newTracks = state.tracks.map(track =>
      track.id === trackId
        ? {
            ...track,
            clips: track.clips.map(clip => {
              if (clip.id !== clipId || !clip.keyframes) return clip;
              const newKeyframes = { ...clip.keyframes } as typeof clip.keyframes;
              for (const key of Object.keys(newKeyframes) as Array<keyof ClipEffects>) {
                const kfs = newKeyframes[key];
                if (!kfs) continue;
                const moved = kfs.map(kf =>
                  Math.abs(kf.time - fromTime) <= 0.001 ? { ...kf, time: toTime } : kf
                );
                const sorted = moved.sort((a, b) => a.time - b.time);
                // 同時刻のキーフレームを重複排除（後者を優先、addKeyframe の上書きと同じ挙動）
                const deduped: typeof sorted = [];
                for (const kf of sorted) {
                  const last = deduped[deduped.length - 1];
                  if (last && Math.abs(last.time - kf.time) <= 0.001) {
                    deduped[deduped.length - 1] = kf;
                  } else {
                    deduped.push(kf);
                  }
                }
                newKeyframes[key] = deduped;
              }
              return { ...clip, keyframes: newKeyframes };
            }),
          }
        : track
    );
    return withHistory(state, newTracks);
  }),

  deleteKeyframesAtTime: (trackId: string, clipId: string, time: number) => set((state) => {
    logAction('deleteKeyframesAtTime', `track=${trackId} clip=${clipId} time=${time.toFixed(2)}`);
    const newTracks = state.tracks.map(track =>
      track.id === trackId
        ? {
            ...track,
            clips: track.clips.map(clip => {
              if (clip.id !== clipId || !clip.keyframes) return clip;
              const newKeyframes = { ...clip.keyframes } as typeof clip.keyframes;
              for (const key of Object.keys(newKeyframes) as Array<keyof ClipEffects>) {
                const kfs = newKeyframes[key];
                if (!kfs) continue;
                const updated = kfs.filter(kf => Math.abs(kf.time - time) > 0.001);
                if (updated.length === 0) {
                  delete newKeyframes[key];
                } else {
                  newKeyframes[key] = updated;
                }
              }
              const hasKeys = Object.keys(newKeyframes).length > 0;
              return { ...clip, keyframes: hasKeys ? newKeyframes : undefined };
            }),
          }
        : track
    );
    return withHistory(state, newTracks);
  }),

  addToneCurveKeyframe: (trackId: string, clipId: string, keyframe: ToneCurveKeyframe) => set((state) => {
    logAction('addToneCurveKeyframe', `track=${trackId} clip=${clipId} time=${keyframe.time.toFixed(2)}`);
    const newTracks = state.tracks.map(track =>
      track.id === trackId
        ? {
            ...track,
            clips: track.clips.map(clip => {
              if (clip.id !== clipId) return clip;
              const existing = clip.toneCurveKeyframes ?? [];
              const filtered = existing.filter(kf => Math.abs(kf.time - keyframe.time) > 0.001);
              const updated = [...filtered, keyframe].sort((a, b) => a.time - b.time);
              return { ...clip, toneCurveKeyframes: updated };
            }),
          }
        : track
    );
    return withHistory(state, newTracks);
  }),

  removeToneCurveKeyframe: (trackId: string, clipId: string, time: number) => set((state) => {
    logAction('removeToneCurveKeyframe', `track=${trackId} clip=${clipId} time=${time.toFixed(2)}`);
    const newTracks = state.tracks.map(track =>
      track.id === trackId
        ? {
            ...track,
            clips: track.clips.map(clip => {
              if (clip.id !== clipId) return clip;
              const existing = clip.toneCurveKeyframes ?? [];
              const updated = existing.filter(kf => Math.abs(kf.time - time) > 0.001);
              return { ...clip, toneCurveKeyframes: updated.length > 0 ? updated : undefined };
            }),
          }
        : track
    );
    return withHistory(state, newTracks);
  }),

  updateToneCurveKeyframeEasing: (trackId: string, clipId: string, time: number, easing: EasingType) => set((state) => {
    logAction('updateToneCurveKeyframeEasing', `track=${trackId} clip=${clipId} time=${time.toFixed(2)} easing=${easing}`);
    const newTracks = state.tracks.map(track =>
      track.id === trackId
        ? {
            ...track,
            clips: track.clips.map(clip => {
              if (clip.id !== clipId) return clip;
              const existing = clip.toneCurveKeyframes ?? [];
              const updated = existing.map(kf =>
                Math.abs(kf.time - time) <= 0.001 ? { ...kf, easing } : kf
              );
              return { ...clip, toneCurveKeyframes: updated };
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
