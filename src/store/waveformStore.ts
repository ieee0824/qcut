import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

interface WaveformData {
  peaks: [number, number][];
  sampleRate: number;
  sourceDuration: number;
}

interface WaveformState {
  waveforms: Record<string, WaveformData>;
  loading: Record<string, boolean>;
  fetchWaveform: (filePath: string) => Promise<void>;
}

export const useWaveformStore = create<WaveformState>((set, get) => ({
  waveforms: {},
  loading: {},

  fetchWaveform: async (filePath: string) => {
    const state = get();
    if (state.waveforms[filePath] || state.loading[filePath]) return;

    set((s) => ({ loading: { ...s.loading, [filePath]: true } }));

    try {
      const data = await invoke<WaveformData>('get_waveform', { filePath });
      set((s) => ({
        waveforms: { ...s.waveforms, [filePath]: data },
        loading: { ...s.loading, [filePath]: false },
      }));
    } catch (err) {
      console.error('Waveform fetch failed:', filePath, err);
      set((s) => ({ loading: { ...s.loading, [filePath]: false } }));
    }
  },
}));
