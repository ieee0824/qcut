import type { StoreApi } from 'zustand';
import { logAction } from '../actionLogger';
import type { TimelineState, Track } from './types';
import { withHistory } from './historySlice';

type Set = StoreApi<TimelineState>['setState'];
type Get = StoreApi<TimelineState>['getState'];

export const createTrackSlice = (set: Set, get: Get) => ({
  tracks: [] as Track[],

  addTrack: (track: Omit<Track, 'volume' | 'mute' | 'solo'> & Partial<Pick<Track, 'volume' | 'mute' | 'solo'>>) => {
    logAction('addTrack', `id=${track.id} type=${track.type}`);
    set((state) => {
      const withDefaults: Track = { ...track, volume: track.volume ?? 1.0, mute: track.mute ?? false, solo: track.solo ?? false };
      return withHistory(state, [...state.tracks, withDefaults]);
    });
  },

  removeTrack: (trackId: string) => {
    logAction('removeTrack', `id=${trackId}`);
    set((state) => withHistory(state, state.tracks.filter(t => t.id !== trackId)));
  },

  updateTrackVolume: (trackId: string, volume: number) => {
    logAction('updateTrackVolume', `track=${trackId} volume=${volume.toFixed(2)}`);
    set((state) => {
      const newTracks = state.tracks.map(t =>
        t.id === trackId ? { ...t, volume } : t
      );
      return withHistory(state, newTracks);
    });
  },

  toggleMute: (trackId: string) => {
    const track = get().tracks.find(t => t.id === trackId);
    if (!track) return;
    logAction('toggleMute', `track=${trackId} mute=${!track.mute}`);
    set((state) => {
      const newTracks = state.tracks.map(t =>
        t.id === trackId ? { ...t, mute: !t.mute } : t
      );
      return withHistory(state, newTracks);
    });
  },

  toggleSolo: (trackId: string) => {
    const track = get().tracks.find(t => t.id === trackId);
    if (!track) return;
    logAction('toggleSolo', `track=${trackId} solo=${!track.solo}`);
    set((state) => {
      const newTracks = state.tracks.map(t =>
        t.id === trackId ? { ...t, solo: !t.solo } : t
      );
      return withHistory(state, newTracks);
    });
  },
});
