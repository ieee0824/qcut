import type { StoreApi } from 'zustand';
import { logAction } from '../actionLogger';
import type { TimelineHistoryEntry, TimelineState, TimelineTransition, Track } from './types';

const MAX_HISTORY = 50;

function cloneHistoryEntry(entry: TimelineHistoryEntry): TimelineHistoryEntry {
  return JSON.parse(JSON.stringify(entry));
}

function buildHistoryEntry(tracks: Track[], transitions: TimelineTransition[]): TimelineHistoryEntry {
  return cloneHistoryEntry({ tracks, transitions });
}

/** Record new timeline state into history (call with the NEW state) */
export function withHistory(
  state: Pick<TimelineState, '_history' | '_historyIndex' | 'transitions'>,
  newTracks: Track[],
  newTransitions: TimelineTransition[] = state.transitions,
): Pick<TimelineState, 'tracks' | 'transitions' | '_history' | '_historyIndex'> {
  const history = state._history.slice(0, state._historyIndex + 1);
  history.push(buildHistoryEntry(newTracks, newTransitions));
  if (history.length > MAX_HISTORY) history.shift();
  return {
    tracks: newTracks,
    transitions: newTransitions,
    _history: history,
    _historyIndex: history.length - 1,
  };
}

type Set = StoreApi<TimelineState>['setState'];
type Get = StoreApi<TimelineState>['getState'];

export const createHistorySlice = (set: Set, get: Get) => ({
  _history: [{ tracks: [], transitions: [] }] as TimelineHistoryEntry[],
  _historyIndex: 0,

  undo: () => set((state) => {
    if (state._historyIndex <= 0) return state;
    logAction('undo', `index=${state._historyIndex - 1}`);
    const newIndex = state._historyIndex - 1;
    const entry = cloneHistoryEntry(state._history[newIndex]);
    return {
      tracks: entry.tracks,
      transitions: entry.transitions,
      _historyIndex: newIndex,
      selectedClipId: null,
      selectedTrackId: null,
    };
  }),

  redo: () => set((state) => {
    if (state._historyIndex >= state._history.length - 1) return state;
    logAction('redo', `index=${state._historyIndex + 1}`);
    const newIndex = state._historyIndex + 1;
    const entry = cloneHistoryEntry(state._history[newIndex]);
    return {
      tracks: entry.tracks,
      transitions: entry.transitions,
      _historyIndex: newIndex,
      selectedClipId: null,
      selectedTrackId: null,
    };
  }),

  canUndo: () => get()._historyIndex > 0,
  canRedo: () => {
    const s = get();
    return s._historyIndex < s._history.length - 1;
  },

  commitHistory: () => set((state) => {
    const history = state._history.slice(0, state._historyIndex + 1);
    history.push(buildHistoryEntry(state.tracks, state.transitions));
    if (history.length > MAX_HISTORY) history.shift();
    return { _history: history, _historyIndex: history.length - 1 };
  }),
});
