import type { StoreApi } from 'zustand';
import { logAction } from '../actionLogger';
import type { TimelineState, Clip, Track } from './types';
import { withHistory } from './historySlice';

type Set = StoreApi<TimelineState>['setState'];

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

function defaultGenerateId(): string {
  return `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildPastedClip(
  sourceClip: Clip,
  currentTime: number,
  generateId: () => string = defaultGenerateId,
): Clip {
  return {
    ...JSON.parse(JSON.stringify(sourceClip)),
    id: generateId(),
    startTime: currentTime,
  };
}

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

    const resolvedTrackId = resolveTargetTrackId(
      state.tracks, state.selectedTrackId, sourceTrackId, sourceType,
    );
    if (!resolvedTrackId) return state;

    const newClip = buildPastedClip(clip, state.currentTime);

    const newTracks = state.tracks.map(t =>
      t.id === resolvedTrackId
        ? { ...t, clips: [...t.clips, newClip] }
        : t
    );
    return withHistory(state, newTracks);
  }),
});
