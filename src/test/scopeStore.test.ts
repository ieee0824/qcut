import { describe, it, expect, beforeEach } from 'vitest';
import { useScopeStore } from '../store/scopeStore';
import type { HistogramData, VectorscopeData, WaveformData } from '../utils/scopeAnalysis';

describe('scopeStore', () => {
  beforeEach(() => {
    useScopeStore.setState({
      enabled: false,
      activeScopes: new Set(['histogram']),
      histogramData: null,
      vectorscopeData: null,
      waveformData: null,
    });
  });

  it('should have disabled scope by default', () => {
    expect(useScopeStore.getState().enabled).toBe(false);
  });

  it('should have null histogram data by default', () => {
    expect(useScopeStore.getState().histogramData).toBeNull();
  });

  it('should have null vectorscope data by default', () => {
    expect(useScopeStore.getState().vectorscopeData).toBeNull();
  });

  it('should have null waveform data by default', () => {
    expect(useScopeStore.getState().waveformData).toBeNull();
  });

  it('should have histogram as default active scope', () => {
    expect(useScopeStore.getState().activeScopes.has('histogram')).toBe(true);
    expect(useScopeStore.getState().activeScopes.size).toBe(1);
  });

  it('should toggle enabled state', () => {
    useScopeStore.getState().setEnabled(true);
    expect(useScopeStore.getState().enabled).toBe(true);

    useScopeStore.getState().setEnabled(false);
    expect(useScopeStore.getState().enabled).toBe(false);
  });

  it('should set histogram data', () => {
    const data: HistogramData = {
      r: new Uint32Array(256),
      g: new Uint32Array(256),
      b: new Uint32Array(256),
      luma: new Uint32Array(256),
    };
    data.r[128] = 100;
    data.luma[200] = 50;

    useScopeStore.getState().setHistogramData(data);
    const stored = useScopeStore.getState().histogramData;
    expect(stored).not.toBeNull();
    expect(stored!.r[128]).toBe(100);
    expect(stored!.luma[200]).toBe(50);
  });

  it('should clear histogram data with null', () => {
    const data: HistogramData = {
      r: new Uint32Array(256),
      g: new Uint32Array(256),
      b: new Uint32Array(256),
      luma: new Uint32Array(256),
    };
    useScopeStore.getState().setHistogramData(data);
    expect(useScopeStore.getState().histogramData).not.toBeNull();

    useScopeStore.getState().setHistogramData(null);
    expect(useScopeStore.getState().histogramData).toBeNull();
  });

  it('should set vectorscope data', () => {
    const data: VectorscopeData = {
      density: new Uint32Array(256 * 256),
      peak: 42,
    };
    data.density[128 * 256 + 128] = 42;

    useScopeStore.getState().setVectorscopeData(data);
    const stored = useScopeStore.getState().vectorscopeData;
    expect(stored).not.toBeNull();
    expect(stored!.density[128 * 256 + 128]).toBe(42);
    expect(stored!.peak).toBe(42);
  });

  it('should clear vectorscope data with null', () => {
    const data: VectorscopeData = {
      density: new Uint32Array(256 * 256),
      peak: 1,
    };
    useScopeStore.getState().setVectorscopeData(data);
    expect(useScopeStore.getState().vectorscopeData).not.toBeNull();

    useScopeStore.getState().setVectorscopeData(null);
    expect(useScopeStore.getState().vectorscopeData).toBeNull();
  });

  it('should set waveform data', () => {
    const data: WaveformData = {
      density: new Uint32Array(160 * 256),
      peak: 10,
      columns: 160,
    };
    data.density[0 * 256 + 255] = 10;

    useScopeStore.getState().setWaveformData(data);
    const stored = useScopeStore.getState().waveformData;
    expect(stored).not.toBeNull();
    expect(stored!.density[0 * 256 + 255]).toBe(10);
    expect(stored!.columns).toBe(160);
  });

  it('should clear waveform data with null', () => {
    const data: WaveformData = {
      density: new Uint32Array(160 * 256),
      peak: 1,
      columns: 160,
    };
    useScopeStore.getState().setWaveformData(data);
    expect(useScopeStore.getState().waveformData).not.toBeNull();

    useScopeStore.getState().setWaveformData(null);
    expect(useScopeStore.getState().waveformData).toBeNull();
  });

  it('should toggle scope types', () => {
    const state = useScopeStore.getState();
    // Initially only histogram
    expect(state.activeScopes.has('histogram')).toBe(true);
    expect(state.activeScopes.has('vectorscope')).toBe(false);

    // Add vectorscope
    state.toggleScope('vectorscope');
    expect(useScopeStore.getState().activeScopes.has('vectorscope')).toBe(true);
    expect(useScopeStore.getState().activeScopes.has('histogram')).toBe(true);

    // Remove histogram
    useScopeStore.getState().toggleScope('histogram');
    expect(useScopeStore.getState().activeScopes.has('histogram')).toBe(false);
    expect(useScopeStore.getState().activeScopes.has('vectorscope')).toBe(true);
  });

  it('should add waveform scope', () => {
    useScopeStore.getState().toggleScope('waveform');
    expect(useScopeStore.getState().activeScopes.has('waveform')).toBe(true);
    expect(useScopeStore.getState().activeScopes.has('histogram')).toBe(true);
  });
});
