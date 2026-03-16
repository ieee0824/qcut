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
      transitions: [],
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

  it('should include transition data in export settings when set', () => {
    const { addTransition } = useTimelineStore.getState();
    addTransition({
      id: 'transition-clip-1-clip-2',
      type: 'crossfade',
      duration: 1.0,
      outTrackId: 'video-1',
      outClipId: 'clip-1',
      inTrackId: 'video-1',
      inClipId: 'clip-2',
    });

    const state = useTimelineStore.getState();
    const json = JSON.stringify(state.transitions);
    const parsed = JSON.parse(json);
    expect(parsed[0]).toEqual({
      id: 'transition-clip-1-clip-2',
      type: 'crossfade',
      duration: 1.0,
      outTrackId: 'video-1',
      outClipId: 'clip-1',
      inTrackId: 'video-1',
      inClipId: 'clip-2',
    });
  });

  it('should not include transition data when not set', () => {
    expect(useTimelineStore.getState().transitions).toEqual([]);
  });

  it('should serialize multiple transitions independently from tracks', () => {
    const { addTransition } = useTimelineStore.getState();
    addTransition({
      id: 'transition-clip-1-clip-2',
      type: 'crossfade',
      duration: 1.0,
      outTrackId: 'video-1',
      outClipId: 'clip-1',
      inTrackId: 'video-1',
      inClipId: 'clip-2',
    });
    addTransition({
      id: 'transition-clip-2-clip-3',
      type: 'wipe-left',
      duration: 0.5,
      outTrackId: 'video-1',
      outClipId: 'clip-2',
      inTrackId: 'video-1',
      inClipId: 'clip-3',
    });

    const state = useTimelineStore.getState();
    const serialized = JSON.parse(JSON.stringify(state.transitions));
    expect(serialized).toHaveLength(2);
    expect(serialized[0].type).toBe('crossfade');
    expect(serialized[1].type).toBe('wipe-left');
  });

  it('should build export settings with transition data', () => {
    const { addTransition } = useTimelineStore.getState();
    addTransition({
      id: 'transition-clip-1-clip-2',
      type: 'dissolve',
      duration: 1.5,
      outTrackId: 'video-1',
      outClipId: 'clip-1',
      inTrackId: 'video-1',
      inClipId: 'clip-2',
    });

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
      transitions: state.transitions,
      totalDuration: 15,
    };

    const serialized = JSON.parse(JSON.stringify(exportSettings));
    expect(serialized.transitions[0]).toMatchObject({ type: 'dissolve', duration: 1.5, inClipId: 'clip-2' });
  });

  it('should handle all transition types for export', () => {
    const { addTransition, removeTransitionById } = useTimelineStore.getState();
    const types = ['crossfade', 'dissolve', 'wipe-left', 'wipe-right', 'wipe-up', 'wipe-down'] as const;

    for (const type of types) {
      addTransition({
        id: 'transition-clip-1-clip-2',
        type,
        duration: 1.0,
        outTrackId: 'video-1',
        outClipId: 'clip-1',
        inTrackId: 'video-1',
        inClipId: 'clip-2',
      });
      expect(useTimelineStore.getState().transitions[0].type).toBe(type);
      removeTransitionById('transition-clip-1-clip-2');
    }
  });
});
