import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTimelineStore } from '../store/timelineStore';
import { generateId } from '../utils/idGenerator';

describe('ファイルインポート時のクリップ追加フロー', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      tracks: [
        { id: 'video-1', type: 'video', name: 'Video 1', clips: [], volume: 1.0, mute: false, solo: false },
      ],
      currentTime: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generateId で生成したクリップ ID が正しい形式でタイムラインに追加される', () => {
    vi.spyOn(Date, 'now').mockReturnValue(2000);
    vi.spyOn(Math, 'random').mockReturnValue(0.3);

    const clipId = generateId('clip');
    useTimelineStore.getState().addClip('video-1', {
      id: clipId,
      name: 'sample.mp4',
      startTime: 0,
      duration: 10,
      filePath: '/videos/sample.mp4',
      sourceStartTime: 0,
      sourceEndTime: 10,
      color: '#4a9eff',
    });

    const state = useTimelineStore.getState();
    const clip = state.tracks[0].clips[0];
    expect(clip.id).toMatch(/^clip-/);
    expect(clip.id).toBe(clipId);
    expect(clip.name).toBe('sample.mp4');
    expect(clip.filePath).toBe('/videos/sample.mp4');
    expect(clip.duration).toBe(10);
  });

  it('音声ファイルのクリップも generateId で ID が生成される', () => {
    useTimelineStore.setState({
      tracks: [
        { id: 'audio-1', type: 'audio', name: 'Audio 1', clips: [], volume: 1.0, mute: false, solo: false },
      ],
    });

    const clipId = generateId('clip');
    useTimelineStore.getState().addClip('audio-1', {
      id: clipId,
      name: 'bgm.mp3',
      startTime: 0,
      duration: 60,
      filePath: '/audio/bgm.mp3',
      sourceStartTime: 0,
      sourceEndTime: 60,
      color: '#4caf50',
    });

    const clip = useTimelineStore.getState().tracks[0].clips[0];
    expect(clip.id).toMatch(/^clip-/);
    expect(clip.color).toBe('#4caf50');
  });
});
