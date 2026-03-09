import type { StoreApi } from 'zustand';
import { logAction } from '../actionLogger';
import type { TimelineState, Track } from './types';
import { withHistory } from './historySlice';

type Set = StoreApi<TimelineState>['setState'];

export const createTrackSlice = (set: Set) => ({
  tracks: [] as Track[],

  addTrack: (track: Omit<Track, 'volume' | 'mute' | 'solo'> & Partial<Pick<Track, 'volume' | 'mute' | 'solo'>>) => set((state) => {
    logAction('addTrack', `id=${track.id} type=${track.type}`);
    const withDefaults: Track = { ...track, volume: track.volume ?? 1.0, mute: track.mute ?? false, solo: track.solo ?? false };
    return withHistory(state, [...state.tracks, withDefaults]);
  }),

  removeTrack: (trackId: string) => set((state) => {
    logAction('removeTrack', `id=${trackId}`);
    return withHistory(state, state.tracks.filter(t => t.id !== trackId));
  }),

  updateTrackVolume: (trackId: string, volume: number) => set((state) => {
    logAction('updateTrackVolume', `track=${trackId} volume=${volume.toFixed(2)}`);
    const newTracks = state.tracks.map(t =>
      t.id === trackId ? { ...t, volume } : t
    );
    return withHistory(state, newTracks);
  }),

  toggleMute: (trackId: string) => set((state) => {
    const track = state.tracks.find(t => t.id === trackId);
    if (!track) return state;
    logAction('toggleMute', `track=${trackId} mute=${!track.mute}`);
    const newTracks = state.tracks.map(t =>
      t.id === trackId ? { ...t, mute: !t.mute } : t
    );
    return withHistory(state, newTracks);
  }),

  toggleSolo: (trackId: string) => set((state) => {
    const track = state.tracks.find(t => t.id === trackId);
    if (!track) return state;
    logAction('toggleSolo', `track=${trackId} solo=${!track.solo}`);
    const newTracks = state.tracks.map(t =>
      t.id === trackId ? { ...t, solo: !t.solo } : t
    );
    return withHistory(state, newTracks);
  }),
});
