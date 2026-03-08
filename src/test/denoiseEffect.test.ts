import { describe, it, expect, beforeEach } from 'vitest';
import { useTimelineStore, DEFAULT_EFFECTS } from '../store/timelineStore';

/**
 * ノイズリダクションエフェクトのテスト
 * ClipEffects の denoiseAmount / highpassFreq プロパティと更新ロジックを検証
 */

describe('denoise effect', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      tracks: [],
      selectedClipId: null,
      selectedTrackId: null,
      currentTime: 0,
      isPlaying: false,
      pixelsPerSecond: 50,
    });
  });

  it('should have denoiseAmount and highpassFreq in DEFAULT_EFFECTS with default value 0', () => {
    expect(DEFAULT_EFFECTS.denoiseAmount).toBe(0);
    expect(DEFAULT_EFFECTS.highpassFreq).toBe(0);
  });

  it('should store denoiseAmount in clip effects', () => {
    const { addTrack, addClip, updateClip } = useTimelineStore.getState();
    addTrack({ id: 'video-1', type: 'video', name: 'Video 1', clips: [] });
    addClip('video-1', {
      id: 'clip-1',
      name: 'Clip 1',
      startTime: 0,
      duration: 5,
      filePath: 'a.mp4',
      sourceStartTime: 0,
      sourceEndTime: 5,
    });

    updateClip('video-1', 'clip-1', {
      effects: { ...DEFAULT_EFFECTS, denoiseAmount: 0.7 },
    });

    const state = useTimelineStore.getState();
    const clip = state.tracks[0].clips[0];
    expect(clip.effects?.denoiseAmount).toBe(0.7);
  });

  it('should store highpassFreq in clip effects', () => {
    const { addTrack, addClip, updateClip } = useTimelineStore.getState();
    addTrack({ id: 'audio-1', type: 'audio', name: 'Audio 1', clips: [] });
    addClip('audio-1', {
      id: 'audio-clip-1',
      name: 'bgm.mp3',
      startTime: 0,
      duration: 30,
      filePath: '/path/to/bgm.mp3',
      sourceStartTime: 0,
      sourceEndTime: 30,
    });

    updateClip('audio-1', 'audio-clip-1', {
      effects: { ...DEFAULT_EFFECTS, highpassFreq: 200 },
    });

    const state = useTimelineStore.getState();
    const clip = state.tracks[0].clips[0];
    expect(clip.effects?.highpassFreq).toBe(200);
  });

  it('should include denoise fields in JSON serialization for export', () => {
    const { addTrack, addClip, updateClip } = useTimelineStore.getState();
    addTrack({ id: 'video-1', type: 'video', name: 'Video 1', clips: [] });
    addClip('video-1', {
      id: 'clip-1',
      name: 'Clip 1',
      startTime: 0,
      duration: 5,
      filePath: 'a.mp4',
      sourceStartTime: 0,
      sourceEndTime: 5,
    });

    updateClip('video-1', 'clip-1', {
      effects: { ...DEFAULT_EFFECTS, denoiseAmount: 0.5, highpassFreq: 100 },
    });

    const state = useTimelineStore.getState();
    const clip = state.tracks[0].clips[0];
    const json = JSON.stringify(clip);
    const parsed = JSON.parse(json);
    expect(parsed.effects.denoiseAmount).toBe(0.5);
    expect(parsed.effects.highpassFreq).toBe(100);
  });

  it('should reset denoise fields when resetting all effects', () => {
    const { addTrack, addClip, updateClip } = useTimelineStore.getState();
    addTrack({ id: 'video-1', type: 'video', name: 'Video 1', clips: [] });
    addClip('video-1', {
      id: 'clip-1',
      name: 'Clip 1',
      startTime: 0,
      duration: 5,
      filePath: 'a.mp4',
      sourceStartTime: 0,
      sourceEndTime: 5,
    });

    updateClip('video-1', 'clip-1', {
      effects: { ...DEFAULT_EFFECTS, denoiseAmount: 0.8, highpassFreq: 300 },
    });

    updateClip('video-1', 'clip-1', {
      effects: { ...DEFAULT_EFFECTS },
    });

    const state = useTimelineStore.getState();
    const clip = state.tracks[0].clips[0];
    expect(clip.effects?.denoiseAmount).toBe(0);
    expect(clip.effects?.highpassFreq).toBe(0);
  });
});
