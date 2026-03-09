import { describe, it, expect, beforeEach } from 'vitest';
import { useScopeStore } from '../store/scopeStore';
import type { HistogramData } from '../utils/scopeAnalysis';

describe('scopeStore', () => {
  beforeEach(() => {
    useScopeStore.setState({
      enabled: false,
      histogramData: null,
    });
  });

  it('should have disabled scope by default', () => {
    expect(useScopeStore.getState().enabled).toBe(false);
  });

  it('should have null histogram data by default', () => {
    expect(useScopeStore.getState().histogramData).toBeNull();
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
});
