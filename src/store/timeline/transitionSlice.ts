import type { StoreApi } from 'zustand';
import { logAction } from '../actionLogger';
import type { TimelineState, TimelineTransition } from './types';
import { withHistory } from './historySlice';

type Set = StoreApi<TimelineState>['setState'];
type Get = StoreApi<TimelineState>['getState'];

function hasDuplicateTransition(
  transitions: TimelineTransition[],
  candidate: TimelineTransition,
): boolean {
  return transitions.some((transition) =>
    transition.outClipId === candidate.outClipId
    && transition.inClipId === candidate.inClipId
    && transition.outTrackId === candidate.outTrackId
    && transition.inTrackId === candidate.inTrackId,
  );
}

export const createTransitionSlice = (set: Set, get: Get) => ({
  transitions: [] as TimelineTransition[],

  addTransition: (transition: TimelineTransition) => set((state) => {
    if (hasDuplicateTransition(state.transitions, transition)) {
      return state;
    }

    logAction(
      'addTransition',
      `id=${transition.id} out=${transition.outTrackId}/${transition.outClipId} in=${transition.inTrackId}/${transition.inClipId}`,
    );

    return withHistory(state, state.tracks, [...state.transitions, transition]);
  }),

  removeTransitionById: (transitionId: string) => set((state) => {
    const newTransitions = state.transitions.filter((transition) => transition.id !== transitionId);
    if (newTransitions.length === state.transitions.length) {
      return state;
    }

    logAction('removeTransitionById', `id=${transitionId}`);
    return withHistory(state, state.tracks, newTransitions);
  }),

  updateTransition: (
    transitionId: string,
    updates: Partial<Pick<TimelineTransition, 'type' | 'duration'>>,
  ) => set((state) => {
    let changed = false;
    const newTransitions = state.transitions.map((transition) => {
      if (transition.id !== transitionId) {
        return transition;
      }

      changed = true;
      return { ...transition, ...updates };
    });

    if (!changed) {
      return state;
    }

    logAction('updateTransition', `id=${transitionId} keys=${Object.keys(updates).join(',')}`);
    return withHistory(state, state.tracks, newTransitions);
  }),

  findTransitionByClipId: (clipId: string) =>
    get().transitions.find((transition) =>
      transition.outClipId === clipId || transition.inClipId === clipId,
    ),
});
