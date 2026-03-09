import { create } from 'zustand';
import type { HistogramData, VectorscopeData, WaveformData } from '../utils/scopeAnalysis';

export type ScopeType = 'histogram' | 'vectorscope' | 'waveform';

interface ScopeState {
  enabled: boolean;
  activeScopes: Set<ScopeType>;
  histogramData: HistogramData | null;
  vectorscopeData: VectorscopeData | null;
  waveformData: WaveformData | null;
  setEnabled: (enabled: boolean) => void;
  toggleScope: (scope: ScopeType) => void;
  setHistogramData: (data: HistogramData | null) => void;
  setVectorscopeData: (data: VectorscopeData | null) => void;
  setWaveformData: (data: WaveformData | null) => void;
}

export const useScopeStore = create<ScopeState>((set, get) => ({
  enabled: false,
  activeScopes: new Set<ScopeType>(['histogram']),
  histogramData: null,
  vectorscopeData: null,
  waveformData: null,
  setEnabled: (enabled) => set({ enabled }),
  toggleScope: (scope) => {
    const current = get().activeScopes;
    const next = new Set(current);
    if (next.has(scope)) {
      next.delete(scope);
    } else {
      next.add(scope);
    }
    set({ activeScopes: next });
  },
  setHistogramData: (histogramData) => set({ histogramData }),
  setVectorscopeData: (vectorscopeData) => set({ vectorscopeData }),
  setWaveformData: (waveformData) => set({ waveformData }),
}));
