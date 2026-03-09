import { create } from 'zustand';
import type { HistogramData } from '../utils/scopeAnalysis';

export type ScopeType = 'histogram';

interface ScopeState {
  enabled: boolean;
  histogramData: HistogramData | null;
  setEnabled: (enabled: boolean) => void;
  setHistogramData: (data: HistogramData | null) => void;
}

export const useScopeStore = create<ScopeState>((set) => ({
  enabled: false,
  histogramData: null,
  setEnabled: (enabled) => set({ enabled }),
  setHistogramData: (histogramData) => set({ histogramData }),
}));
