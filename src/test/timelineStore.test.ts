import { describe, it, expect, beforeEach } from 'vitest';
import { useTimelineStore, type ClipTransition } from '../store/timelineStore';

describe('timelineStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useTimelineStore.setState({
      tracks: [],
      transitions: [],
      selectedClipId: null,
      selectedTrackId: null,
      currentTime: 0,
      isPlaying: false,
      pixelsPerSecond: 50,
    });
  });

  it('should have initial state', () => {
    const state = useTimelineStore.getState();
    expect(state.pixelsPerSecond).toBe(50);
    expect(state.currentTime).toBe(0);
    expect(state.isPlaying).toBe(false);
    expect(state.tracks).toHaveLength(0);
  });

  it('should add clip to track', () => {
    const { addClip, addTrack } = useTimelineStore.getState();

    addTrack({
      id: 'video-1',
      type: 'video',
      name: 'Video 1',
      clips: [],
    });
    
    addClip('video-1', {
      id: 'test-clip',
      name: 'Test Clip',
      startTime: 0,
      duration: 5,
      filePath: 'test.mp4',
      sourceStartTime: 0,
      sourceEndTime: 5,
    });

    const state = useTimelineStore.getState();
    const track = state.tracks.find(t => t.id === 'video-1');
    expect(track.clips).toHaveLength(1);
    expect(track.clips[0].id).toBe('test-clip');
  });

  it('should remove clip from track', () => {
    const { addClip, addTrack, removeClip } = useTimelineStore.getState();

    addTrack({
      id: 'video-1',
      type: 'video',
      name: 'Video 1',
      clips: [],
    });
    
    addClip('video-1', {
      id: 'test-clip',
      name: 'Test Clip',
      startTime: 0,
      duration: 5,
      filePath: 'test.mp4',
      sourceStartTime: 0,
      sourceEndTime: 5,
    });

    removeClip('video-1', 'test-clip');

    const state = useTimelineStore.getState();
    const track = state.tracks.find(t => t.id === 'video-1');
    expect(track).toBeUndefined();
  });

  it('should zoom in', () => {
    const { zoomIn, pixelsPerSecond } = useTimelineStore.getState();
    const initialPPS = pixelsPerSecond;
    
    zoomIn();
    
    const state = useTimelineStore.getState();
    expect(state.pixelsPerSecond).toBeGreaterThan(initialPPS);
  });

  it('should zoom out', () => {
    const { zoomOut, pixelsPerSecond } = useTimelineStore.getState();
    const initialPPS = pixelsPerSecond;
    
    zoomOut();
    
    const state = useTimelineStore.getState();
    expect(state.pixelsPerSecond).toBeLessThan(initialPPS);
  });

  it('should not zoom beyond limits', () => {
    const { zoomIn, zoomOut } = useTimelineStore.getState();

    // Zoom in to max
    for (let i = 0; i < 20; i++) {
      zoomIn();
    }
    const maxState = useTimelineStore.getState();
    expect(maxState.pixelsPerSecond).toBeLessThanOrEqual(200);

    // Zoom out to min
    for (let i = 0; i < 40; i++) {
      zoomOut();
    }
    const minState = useTimelineStore.getState();
    expect(minState.pixelsPerSecond).toBeGreaterThanOrEqual(10);
  });

  describe('transition', () => {
    const transition: ClipTransition = { type: 'crossfade', duration: 1.0 };

    beforeEach(() => {
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

    it('should set transition on a clip', () => {
      const { setTransition } = useTimelineStore.getState();
      setTransition('video-1', 'clip-2', transition);

      const state = useTimelineStore.getState();
      const track = state.tracks.find(t => t.id === 'video-1');
      const clip = track!.clips.find(c => c.id === 'clip-2');
      expect(clip!.transition).toEqual(transition);
    });

    it('should remove transition from a clip', () => {
      const { setTransition, removeTransition } = useTimelineStore.getState();
      setTransition('video-1', 'clip-2', transition);
      removeTransition('video-1', 'clip-2');

      const state = useTimelineStore.getState();
      const track = state.tracks.find(t => t.id === 'video-1');
      const clip = track!.clips.find(c => c.id === 'clip-2');
      expect(clip!.transition).toBeUndefined();
    });

    it('should not affect other clips when setting transition', () => {
      const { setTransition } = useTimelineStore.getState();
      setTransition('video-1', 'clip-2', transition);

      const state = useTimelineStore.getState();
      const track = state.tracks.find(t => t.id === 'video-1');
      const clip1 = track!.clips.find(c => c.id === 'clip-1');
      expect(clip1!.transition).toBeUndefined();
    });

    it('should handle setting transition on non-existent clip gracefully', () => {
      const { setTransition } = useTimelineStore.getState();
      setTransition('video-1', 'non-existent', transition);

      const state = useTimelineStore.getState();
      const track = state.tracks.find(t => t.id === 'video-1');
      expect(track!.clips).toHaveLength(2);
      expect(track!.clips.every(c => c.transition === undefined)).toBe(true);
    });
  });
});
