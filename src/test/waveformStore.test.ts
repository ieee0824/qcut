import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { useWaveformStore } from '../store/waveformStore';
import { invoke } from '@tauri-apps/api/core';

describe('waveformStore', () => {
  beforeEach(() => {
    useWaveformStore.setState({ waveforms: {}, loading: {} });
    vi.clearAllMocks();
  });

  it('should fetch waveform and cache it', async () => {
    const mockData = {
      peaks: [[-0.5, 0.5], [-0.3, 0.7]] as [number, number][],
      sampleRate: 1000,
      sourceDuration: 0.002,
    };
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

    await useWaveformStore.getState().fetchWaveform('/test/audio.mp3');

    expect(invoke).toHaveBeenCalledWith('get_waveform', { filePath: '/test/audio.mp3' });
    expect(useWaveformStore.getState().waveforms['/test/audio.mp3']).toEqual(mockData);
    expect(useWaveformStore.getState().loading['/test/audio.mp3']).toBe(false);
  });

  it('should not refetch if already cached', async () => {
    useWaveformStore.setState({
      waveforms: { '/test/audio.mp3': { peaks: [], sampleRate: 1000, sourceDuration: 0 } },
    });

    await useWaveformStore.getState().fetchWaveform('/test/audio.mp3');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('should not refetch if already loading', async () => {
    useWaveformStore.setState({ loading: { '/test/audio.mp3': true } });

    await useWaveformStore.getState().fetchWaveform('/test/audio.mp3');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('should handle fetch errors gracefully', async () => {
    (invoke as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('FFmpeg not found'));

    await useWaveformStore.getState().fetchWaveform('/test/bad.mp3');

    expect(useWaveformStore.getState().waveforms['/test/bad.mp3']).toBeUndefined();
    expect(useWaveformStore.getState().loading['/test/bad.mp3']).toBe(false);
  });
});
