import { describe, it, expect, beforeEach } from 'vitest';
import { useTimelineStore } from '../store/timelineStore';

/**
 * トランジション付きクリップのエクスポートデータ構築テスト
 * Rust 側の ExportClip に transition フィールドが正しく含まれることを確認
 */

describe('transition export data', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      tracks: [],
      selectedClipId: null,
      selectedTrackId: null,
      currentTime: 0,
      isPlaying: false,
      pixelsPerSecond: 50,
    });

    const { addTrack, addClip } = useTimelineStore.getState();
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
    addClip('video-1', {
      id: 'clip-2',
      name: 'Clip 2',
      startTime: 5,
      duration: 5,
      filePath: 'b.mp4',
      sourceStartTime: 0,
      sourceEndTime: 5,
    });
    addClip('video-1', {
      id: 'clip-3',
      name: 'Clip 3',
      startTime: 10,
      duration: 5,
      filePath: 'c.mp4',
      sourceStartTime: 0,
      sourceEndTime: 5,
    });
  });

  it('should include transition data in clip when set', () => {
    const { setTransition } = useTimelineStore.getState();
    setTransition('video-1', 'clip-2', { type: 'crossfade', duration: 1.0 });

    const state = useTimelineStore.getState();
    const track = state.tracks.find(t => t.id === 'video-1')!;
    const clip2 = track.clips.find(c => c.id === 'clip-2')!;

    expect(clip2.transition).toEqual({ type: 'crossfade', duration: 1.0 });
    // JSON シリアライズ時に transition が含まれることを確認
    const json = JSON.stringify(clip2);
    const parsed = JSON.parse(json);
    expect(parsed.transition).toEqual({ type: 'crossfade', duration: 1.0 });
  });

  it('should not include transition data when not set', () => {
    const state = useTimelineStore.getState();
    const track = state.tracks.find(t => t.id === 'video-1')!;
    const clip1 = track.clips.find(c => c.id === 'clip-1')!;

    expect(clip1.transition).toBeUndefined();
  });

  it('should serialize tracks with mixed transition states', () => {
    const { setTransition } = useTimelineStore.getState();
    setTransition('video-1', 'clip-2', { type: 'crossfade', duration: 1.0 });
    setTransition('video-1', 'clip-3', { type: 'wipe-left', duration: 0.5 });

    const state = useTimelineStore.getState();
    const tracks = state.tracks;
    const serialized = JSON.parse(JSON.stringify(tracks));

    const videoTrack = serialized.find((t: { id: string }) => t.id === 'video-1');
    expect(videoTrack.clips[0].transition).toBeUndefined();
    expect(videoTrack.clips[1].transition).toEqual({ type: 'crossfade', duration: 1.0 });
    expect(videoTrack.clips[2].transition).toEqual({ type: 'wipe-left', duration: 0.5 });
  });

  it('should build export settings with transition data', () => {
    const { setTransition } = useTimelineStore.getState();
    setTransition('video-1', 'clip-2', { type: 'dissolve', duration: 1.5 });

    const state = useTimelineStore.getState();
    // ExportDialog が構築するのと同じ形式
    const exportSettings = {
      format: 'mp4',
      width: 1920,
      height: 1080,
      bitrate: '8M',
      fps: 30,
      outputPath: '/tmp/test.mp4',
      tracks: state.tracks,
      totalDuration: 15,
    };

    const serialized = JSON.parse(JSON.stringify(exportSettings));
    const videoTrack = serialized.tracks.find((t: { type: string }) => t.type === 'video');
    const clip2 = videoTrack.clips.find((c: { id: string }) => c.id === 'clip-2');
    expect(clip2.transition).toEqual({ type: 'dissolve', duration: 1.5 });
  });

  it('should handle all transition types for export', () => {
    const { setTransition } = useTimelineStore.getState();
    const types = ['crossfade', 'dissolve', 'wipe-left', 'wipe-right', 'wipe-up', 'wipe-down'] as const;

    for (const type of types) {
      setTransition('video-1', 'clip-2', { type, duration: 1.0 });
      const state = useTimelineStore.getState();
      const track = state.tracks.find(t => t.id === 'video-1')!;
      const clip2 = track.clips.find(c => c.id === 'clip-2')!;
      expect(clip2.transition!.type).toBe(type);
    }
  });
});
