import { describe, it, expect, beforeEach } from 'vitest';
import { useTimelineStore } from '../store/timelineStore';

describe('transition UI integration', () => {
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
  });

  it('should add default crossfade transition via context menu action', () => {
    const { setTransition } = useTimelineStore.getState();
    setTransition('video-1', 'clip-2', { type: 'crossfade', duration: 1.0 });

    const state = useTimelineStore.getState();
    const track = state.tracks.find(t => t.id === 'video-1');
    const clip2 = track!.clips.find(c => c.id === 'clip-2');
    expect(clip2!.transition).toEqual({ type: 'crossfade', duration: 1.0 });
  });

  it('should remove transition via context menu action', () => {
    const { setTransition, removeTransition } = useTimelineStore.getState();
    setTransition('video-1', 'clip-2', { type: 'crossfade', duration: 1.0 });
    removeTransition('video-1', 'clip-2');

    const state = useTimelineStore.getState();
    const track = state.tracks.find(t => t.id === 'video-1');
    const clip2 = track!.clips.find(c => c.id === 'clip-2');
    expect(clip2!.transition).toBeUndefined();
  });

  it('should change transition type', () => {
    const { setTransition } = useTimelineStore.getState();
    setTransition('video-1', 'clip-2', { type: 'crossfade', duration: 1.0 });
    setTransition('video-1', 'clip-2', { type: 'dissolve', duration: 1.0 });

    const state = useTimelineStore.getState();
    const track = state.tracks.find(t => t.id === 'video-1');
    const clip2 = track!.clips.find(c => c.id === 'clip-2');
    expect(clip2!.transition!.type).toBe('dissolve');
  });

  it('should change transition duration', () => {
    const { setTransition } = useTimelineStore.getState();
    setTransition('video-1', 'clip-2', { type: 'crossfade', duration: 1.0 });
    setTransition('video-1', 'clip-2', { type: 'crossfade', duration: 2.5 });

    const state = useTimelineStore.getState();
    const track = state.tracks.find(t => t.id === 'video-1');
    const clip2 = track!.clips.find(c => c.id === 'clip-2');
    expect(clip2!.transition!.duration).toBe(2.5);
  });

  it('should identify first clip has no previous clip', () => {
    const state = useTimelineStore.getState();
    const track = state.tracks.find(t => t.id === 'video-1');
    const clipIndex = track!.clips.findIndex(c => c.id === 'clip-1');
    expect(clipIndex).toBe(0);
    // First clip should not have a "previous" clip
    expect(clipIndex > 0).toBe(false);
  });

  it('should identify second clip has a previous clip', () => {
    const state = useTimelineStore.getState();
    const track = state.tracks.find(t => t.id === 'video-1');
    const clipIndex = track!.clips.findIndex(c => c.id === 'clip-2');
    expect(clipIndex).toBe(1);
    expect(clipIndex > 0).toBe(true);
  });
});
