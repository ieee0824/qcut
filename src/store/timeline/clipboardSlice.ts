import type { StoreApi } from 'zustand';
import { logAction } from '../actionLogger';
import type { TimelineState, Clip, Track } from './types';
import { withHistory } from './historySlice';
import { generateId } from '../../utils/idGenerator';

type Set = StoreApi<TimelineState>['setState'];
type Get = StoreApi<TimelineState>['getState'];

export function resolveTargetTrackId(
  tracks: Track[],
  selectedTrackId: string | null,
  sourceTrackId: string,
  sourceType: Track['type'],
): string | null {
  let resolvedTrackId: string | null = selectedTrackId;

  // 選択中トラックがコピー元と異なるタイプならスキップ
  if (resolvedTrackId) {
    const selectedTrack = tracks.find(t => t.id === resolvedTrackId);
    if (selectedTrack && selectedTrack.type !== sourceType) {
      resolvedTrackId = null;
    }
  }

  if (!resolvedTrackId) {
    resolvedTrackId = sourceTrackId;
  }

  // コピー元トラックが削除済みの場合、同タイプの最初のトラックにフォールバック
  if (!tracks.find(t => t.id === resolvedTrackId)) {
    const fallback = tracks.find(t => t.type === sourceType);
    if (!fallback) return null;
    resolvedTrackId = fallback.id;
  }

  return resolvedTrackId;
}

export function buildPastedClip(
  sourceClip: Clip,
  currentTime: number,
  idGenerator: () => string = () => generateId('clip'),
): Clip {
  return {
    ...JSON.parse(JSON.stringify(sourceClip)),
    id: idGenerator(),
    startTime: currentTime,
  };
}

export const createClipboardSlice = (set: Set, get: Get) => ({
  _clipboard: null as { trackId: string; trackType: Track['type']; clip: Clip } | null,

  copySelectedClip: () => {
    const state = get();
    if (!state.selectedClipId || !state.selectedTrackId) return;
    const track = state.tracks.find(t => t.id === state.selectedTrackId);
    const clip = track?.clips.find(c => c.id === state.selectedClipId);
    if (!track || !clip) return;
    logAction('copySelectedClip', `track=${state.selectedTrackId} clip=${state.selectedClipId}`);
    set({
      _clipboard: {
        trackId: state.selectedTrackId,
        trackType: track.type,
        clip: JSON.parse(JSON.stringify(clip)),
      },
    });
  },

  pasteClip: () => {
    const state = get();
    if (!state._clipboard) return;
    const { clip, trackId: sourceTrackId, trackType: sourceType } = state._clipboard;
    const resolvedTrackId = resolveTargetTrackId(
      state.tracks, state.selectedTrackId, sourceTrackId, sourceType,
    );
    if (!resolvedTrackId) return;
    logAction('pasteClip', `clip=${state._clipboard.clip.name}`);
    const newClip = buildPastedClip(clip, state.currentTime);
    set((currentState) => {
      const newTracks = currentState.tracks.map(t =>
        t.id === resolvedTrackId
          ? { ...t, clips: [...t.clips, newClip] }
          : t
      );
      return withHistory(currentState, newTracks);
    });
  },
});
