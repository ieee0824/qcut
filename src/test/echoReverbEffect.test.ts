import { describe, it, expect, beforeEach } from 'vitest';
import { useTimelineStore, DEFAULT_EFFECTS } from '../store/timelineStore';

/**
 * エコー・リバーブエフェクトのテスト
 * ClipEffects の echoDelay / echoDecay / reverbAmount プロパティと更新ロジックを検証
 */

describe('echo/reverb effect', () => {
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

  it('should have correct default values in DEFAULT_EFFECTS', () => {
    expect(DEFAULT_EFFECTS.echoDelay).toBe(0);
    expect(DEFAULT_EFFECTS.echoDecay).toBe(0.3);
    expect(DEFAULT_EFFECTS.reverbAmount).toBe(0);
  });

  it('should store echo parameters in clip effects', () => {
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
      effects: { ...DEFAULT_EFFECTS, echoDelay: 500, echoDecay: 0.5 },
    });

    const state = useTimelineStore.getState();
    const clip = state.tracks[0].clips[0];
    expect(clip.effects?.echoDelay).toBe(500);
    expect(clip.effects?.echoDecay).toBe(0.5);
  });

  it('should store reverbAmount in audio track clips', () => {
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
      effects: { ...DEFAULT_EFFECTS, reverbAmount: 0.6 },
    });

    const state = useTimelineStore.getState();
    const clip = state.tracks[0].clips[0];
    expect(clip.effects?.reverbAmount).toBe(0.6);
  });

  it('should include echo/reverb fields in JSON serialization for export', () => {
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
      effects: { ...DEFAULT_EFFECTS, echoDelay: 300, echoDecay: 0.4, reverbAmount: 0.9 },
    });

    const state = useTimelineStore.getState();
    const clip = state.tracks[0].clips[0];
    const json = JSON.stringify(clip);
    const parsed = JSON.parse(json);
    expect(parsed.effects.echoDelay).toBe(300);
    expect(parsed.effects.echoDecay).toBe(0.4);
    expect(parsed.effects.reverbAmount).toBe(0.9);
  });

  it('should reset echo/reverb fields when resetting all effects', () => {
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
      effects: { ...DEFAULT_EFFECTS, echoDelay: 700, echoDecay: 0.8, reverbAmount: 0.5 },
    });

    updateClip('video-1', 'clip-1', {
      effects: { ...DEFAULT_EFFECTS },
    });

    const state = useTimelineStore.getState();
    const clip = state.tracks[0].clips[0];
    expect(clip.effects?.echoDelay).toBe(0);
    expect(clip.effects?.echoDecay).toBe(0.3);
    expect(clip.effects?.reverbAmount).toBe(0);
  });
});
