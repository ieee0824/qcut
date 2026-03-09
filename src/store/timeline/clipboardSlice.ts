import type { StoreApi } from 'zustand';
import { logAction } from '../actionLogger';
import type { TimelineState, Clip, Track } from './types';
import { withHistory } from './historySlice';

type Set = StoreApi<TimelineState>['setState'];

export const createClipboardSlice = (set: Set) => ({
  _clipboard: null as { trackId: string; trackType: Track['type']; clip: Clip } | null,

  copySelectedClip: () => set((state) => {
    if (!state.selectedClipId || !state.selectedTrackId) return state;
    logAction('copySelectedClip', `track=${state.selectedTrackId} clip=${state.selectedClipId}`);
    const track = state.tracks.find(t => t.id === state.selectedTrackId);
    const clip = track?.clips.find(c => c.id === state.selectedClipId);
    if (!track || !clip) return state;
    return { _clipboard: { trackId: state.selectedTrackId, trackType: track.type, clip: JSON.parse(JSON.stringify(clip)) } };
  }),

  pasteClip: () => set((state) => {
    if (!state._clipboard) return state;
    logAction('pasteClip', `clip=${state._clipboard.clip.name}`);
    const { clip, trackId: sourceTrackId, trackType: sourceType } = state._clipboard;

    // ペースト先: 選択中トラック → コピー元トラック → 同タイプの最初のトラック
    let resolvedTrackId: string | null = state.selectedTrackId;

    // 選択中トラックがコピー元と異なるタイプならスキップ
    if (resolvedTrackId) {
      const selectedTrack = state.tracks.find(t => t.id === resolvedTrackId);
      if (selectedTrack && selectedTrack.type !== sourceType) {
        resolvedTrackId = null;
      }
    }

    if (!resolvedTrackId) {
      resolvedTrackId = sourceTrackId;
    }

    // コピー元トラックが削除済みの場合、同タイプの最初のトラックにフォールバック
    if (!state.tracks.find(t => t.id === resolvedTrackId)) {
      const fallback = state.tracks.find(t => t.type === sourceType);
      if (!fallback) return state;
      resolvedTrackId = fallback.id;
    }

    const newClip: Clip = {
      ...JSON.parse(JSON.stringify(clip)),
      id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      startTime: state.currentTime,
    };

    const newTracks = state.tracks.map(t =>
      t.id === resolvedTrackId
        ? { ...t, clips: [...t.clips, newClip] }
        : t
    );
    return withHistory(state, newTracks);
  }),
});
