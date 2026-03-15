import { describe, it, expect, beforeEach } from 'vitest';
import { useTimelineStore } from '../store/timelineStore';

describe('transition UI integration', () => {
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
  });

  it('should add default crossfade transition via context menu action', () => {
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
    expect(state.transitions[0]).toMatchObject({ type: 'crossfade', duration: 1.0, inClipId: 'clip-2' });
  });

  it('should remove transition via context menu action', () => {
    const { addTransition, removeTransitionById } = useTimelineStore.getState();
    addTransition({
      id: 'transition-clip-1-clip-2',
      type: 'crossfade',
      duration: 1.0,
      outTrackId: 'video-1',
      outClipId: 'clip-1',
      inTrackId: 'video-1',
      inClipId: 'clip-2',
    });
    removeTransitionById('transition-clip-1-clip-2');

    expect(useTimelineStore.getState().transitions).toEqual([]);
  });

  it('should change transition type', () => {
    const { addTransition, updateTransition } = useTimelineStore.getState();
    addTransition({
      id: 'transition-clip-1-clip-2',
      type: 'crossfade',
      duration: 1.0,
      outTrackId: 'video-1',
      outClipId: 'clip-1',
      inTrackId: 'video-1',
      inClipId: 'clip-2',
    });
    updateTransition('transition-clip-1-clip-2', { type: 'dissolve' });

    expect(useTimelineStore.getState().transitions[0].type).toBe('dissolve');
  });

  it('should change transition duration', () => {
    const { addTransition, updateTransition } = useTimelineStore.getState();
    addTransition({
      id: 'transition-clip-1-clip-2',
      type: 'crossfade',
      duration: 1.0,
      outTrackId: 'video-1',
      outClipId: 'clip-1',
      inTrackId: 'video-1',
      inClipId: 'clip-2',
    });
    updateTransition('transition-clip-1-clip-2', { duration: 2.5 });

    expect(useTimelineStore.getState().transitions[0].duration).toBe(2.5);
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
