import type { StoreApi } from 'zustand';
import { logAction } from '../actionLogger';
import type { TimelineState, Clip, ClipTransition, ClipEffects, Keyframe, EasingType, ToneCurveKeyframe } from './types';
import { withHistory } from './historySlice';

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
    });
  },

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

  splitClipAtTime: (trackId: string, clipId: string, splitTime: number) => {
    const track = get().tracks.find(t => t.id === trackId);
    if (!track) return;

    const clip = track.clips.find(c => c.id === clipId);
    if (!clip) return;

    const relativeTime = splitTime - clip.startTime;
    if (relativeTime <= 0 || relativeTime >= clip.duration) return;
    logAction('splitClipAtTime', `track=${trackId} clip=${clipId} time=${splitTime.toFixed(2)}`);

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
    });
  },

  removeTransition: (trackId: string, clipId: string) => {
    logAction('removeTransition', `track=${trackId} clip=${clipId}`);
    set((state) => {
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
    });
  },

  addKeyframe: (trackId: string, clipId: string, effectKey: keyof ClipEffects, keyframe: Keyframe) => {
    logAction('addKeyframe', `track=${trackId} clip=${clipId} key=${effectKey} time=${keyframe.time.toFixed(2)}`);
    set((state) => {
      const newTracks = state.tracks.map(track =>
        track.id === trackId
          ? {
              ...track,
              clips: track.clips.map(clip => {
                if (clip.id !== clipId) return clip;
                const existing = clip.keyframes?.[effectKey] ?? [];
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
    });
  },

  removeKeyframe: (trackId: string, clipId: string, effectKey: keyof ClipEffects, time: number) => {
    logAction('removeKeyframe', `track=${trackId} clip=${clipId} key=${effectKey} time=${time.toFixed(2)}`);
    set((state) => {
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
    });
  },

  updateKeyframeEasing: (trackId: string, clipId: string, effectKey: keyof ClipEffects, time: number, easing: EasingType) => {
    logAction('updateKeyframeEasing', `track=${trackId} clip=${clipId} key=${effectKey} time=${time.toFixed(2)} easing=${easing}`);
    set((state) => {
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
    });
  },

  moveKeyframes: (trackId: string, clipId: string, fromTime: number, toTime: number) => {
    logAction('moveKeyframes', `track=${trackId} clip=${clipId} from=${fromTime.toFixed(2)} to=${toTime.toFixed(2)}`);
    set((state) => {
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
    });
  },

  deleteKeyframesAtTime: (trackId: string, clipId: string, time: number) => {
    logAction('deleteKeyframesAtTime', `track=${trackId} clip=${clipId} time=${time.toFixed(2)}`);
    set((state) => {
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
    });
  },

  addToneCurveKeyframe: (trackId: string, clipId: string, keyframe: ToneCurveKeyframe) => {
    logAction('addToneCurveKeyframe', `track=${trackId} clip=${clipId} time=${keyframe.time.toFixed(2)}`);
    set((state) => {
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
    });
  },

  removeToneCurveKeyframe: (trackId: string, clipId: string, time: number) => {
    logAction('removeToneCurveKeyframe', `track=${trackId} clip=${clipId} time=${time.toFixed(2)}`);
    set((state) => {
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
    });
  },

  updateToneCurveKeyframeEasing: (trackId: string, clipId: string, time: number, easing: EasingType) => {
    logAction('updateToneCurveKeyframeEasing', `track=${trackId} clip=${clipId} time=${time.toFixed(2)} easing=${easing}`);
    set((state) => {
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
