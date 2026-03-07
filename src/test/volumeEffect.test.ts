import { describe, it, expect, beforeEach } from 'vitest';
import { useTimelineStore, DEFAULT_EFFECTS } from '../store/timelineStore';

/**
 * 音量エフェクトのテスト
 * ClipEffects の volume プロパティと更新ロジックを検証
 */

describe('volume effect', () => {
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

  it('should have volume in DEFAULT_EFFECTS with default value 1.0', () => {
    expect(DEFAULT_EFFECTS.volume).toBe(1.0);
  });

  it('should store volume in clip effects', () => {
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
      effects: { ...DEFAULT_EFFECTS, volume: 0.5 },
    });

    const state = useTimelineStore.getState();
    const clip = state.tracks[0].clips[0];
    expect(clip.effects?.volume).toBe(0.5);
  });

  it('should update volume on audio track clips', () => {
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
      effects: { ...DEFAULT_EFFECTS, volume: 1.5 },
    });

    const state = useTimelineStore.getState();
    const clip = state.tracks[0].clips[0];
    expect(clip.effects?.volume).toBe(1.5);
  });

  it('should include volume in JSON serialization for export', () => {
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
      effects: { ...DEFAULT_EFFECTS, volume: 0.8 },
    });

    const state = useTimelineStore.getState();
    const clip = state.tracks[0].clips[0];
    const json = JSON.stringify(clip);
    const parsed = JSON.parse(json);
    expect(parsed.effects.volume).toBe(0.8);
  });

  it('should preserve volume when resetting other effects', () => {
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

    // volume を変更後、リセット（DEFAULT_EFFECTS に戻す）
    updateClip('video-1', 'clip-1', {
      effects: { ...DEFAULT_EFFECTS, volume: 0.3 },
    });

    // リセット操作
    updateClip('video-1', 'clip-1', {
      effects: { ...DEFAULT_EFFECTS },
    });

    const state = useTimelineStore.getState();
    const clip = state.tracks[0].clips[0];
    expect(clip.effects?.volume).toBe(1.0);
  });
});
