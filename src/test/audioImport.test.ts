import { describe, it, expect, beforeEach } from 'vitest';
import { useTimelineStore } from '../store/timelineStore';

/**
 * 音声トラック追加・音声クリップ追加のストアテスト
 */

describe('audio import', () => {
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

  it('should add an audio track', () => {
    const { addTrack } = useTimelineStore.getState();
    addTrack({ id: 'audio-1', type: 'audio', name: 'Audio 1', clips: [] });

    const state = useTimelineStore.getState();
    expect(state.tracks).toHaveLength(1);
    expect(state.tracks[0].type).toBe('audio');
    expect(state.tracks[0].id).toBe('audio-1');
  });

  it('should add a clip to an audio track', () => {
    const { addTrack, addClip } = useTimelineStore.getState();
    addTrack({ id: 'audio-1', type: 'audio', name: 'Audio 1', clips: [] });
    addClip('audio-1', {
      id: 'audio-clip-1',
      name: 'bgm.mp3',
      startTime: 0,
      duration: 30,
      filePath: '/path/to/bgm.mp3',
      sourceStartTime: 0,
      sourceEndTime: 30,
      color: '#4caf50',
    });

    const state = useTimelineStore.getState();
    const audioTrack = state.tracks.find(t => t.id === 'audio-1')!;
    expect(audioTrack.clips).toHaveLength(1);
    expect(audioTrack.clips[0].name).toBe('bgm.mp3');
    expect(audioTrack.clips[0].color).toBe('#4caf50');
  });

  it('should support multiple audio tracks', () => {
    const { addTrack } = useTimelineStore.getState();
    addTrack({ id: 'audio-1', type: 'audio', name: 'Audio 1', clips: [] });
    addTrack({ id: 'audio-2', type: 'audio', name: 'Audio 2', clips: [] });

    const state = useTimelineStore.getState();
    const audioTracks = state.tracks.filter(t => t.type === 'audio');
    expect(audioTracks).toHaveLength(2);
  });

  it('should coexist with video and text tracks', () => {
    const { addTrack } = useTimelineStore.getState();
    addTrack({ id: 'video-1', type: 'video', name: 'Video 1', clips: [] });
    addTrack({ id: 'audio-1', type: 'audio', name: 'Audio 1', clips: [] });
    addTrack({ id: 'track-text-1', type: 'text', name: 'Text 1', clips: [] });

    const state = useTimelineStore.getState();
    expect(state.tracks).toHaveLength(3);
    expect(state.tracks.map(t => t.type)).toEqual(['video', 'audio', 'text']);
  });
});
