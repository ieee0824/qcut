import type { StoreApi } from 'zustand';
import { logAction } from '../actionLogger';
import type { TimelineState, Track } from './types';

const MAX_HISTORY = 50;

/** Record new tracks into history (call with the NEW tracks state) */
export function withHistory(
  state: Pick<TimelineState, '_history' | '_historyIndex'>,
  newTracks: Track[],
): Pick<TimelineState, 'tracks' | '_history' | '_historyIndex'> {
  const history = state._history.slice(0, state._historyIndex + 1);
  history.push(JSON.parse(JSON.stringify(newTracks)));
  if (history.length > MAX_HISTORY) history.shift();
  return { tracks: newTracks, _history: history, _historyIndex: history.length - 1 };
}

type Set = StoreApi<TimelineState>['setState'];
type Get = StoreApi<TimelineState>['getState'];

export const createHistorySlice = (set: Set, get: Get) => ({
  _history: [[]] as Track[][],
  _historyIndex: 0,

  undo: () => {
    const state = get();
    if (state._historyIndex <= 0) return;
    logAction('undo', `index=${state._historyIndex - 1}`);
    set((currentState) => {
      const newIndex = currentState._historyIndex - 1;
      return {
        tracks: JSON.parse(JSON.stringify(currentState._history[newIndex])),
        _historyIndex: newIndex,
        selectedClipId: null,
        selectedTrackId: null,
      };
    });
  },

  redo: () => {
    const state = get();
    if (state._historyIndex >= state._history.length - 1) return;
    logAction('redo', `index=${state._historyIndex + 1}`);
    set((currentState) => {
      const newIndex = currentState._historyIndex + 1;
      return {
        tracks: JSON.parse(JSON.stringify(currentState._history[newIndex])),
        _historyIndex: newIndex,
        selectedClipId: null,
        selectedTrackId: null,
      };
    });
  },

  canUndo: () => get()._historyIndex > 0,
  canRedo: () => {
    const s = get();
    return s._historyIndex < s._history.length - 1;
  },

  commitHistory: () => set((state) => {
    const history = state._history.slice(0, state._historyIndex + 1);
    history.push(JSON.parse(JSON.stringify(state.tracks)));
    if (history.length > MAX_HISTORY) history.shift();
    return { _history: history, _historyIndex: history.length - 1 };
  }),
});
