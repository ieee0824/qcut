import { describe, it, expect, beforeEach } from 'vitest';
import { useTimelineStore, type TimelineTransition } from '../store/timelineStore';

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
    expect(track).toBeDefined();
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
    const transition: TimelineTransition = {
      id: 'transition-clip-1-clip-2',
      type: 'crossfade',
      duration: 1.0,
      outTrackId: 'video-1',
      outClipId: 'clip-1',
      inTrackId: 'video-1',
      inClipId: 'clip-2',
    };

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

    it('should add transition entity', () => {
      const { addTransition } = useTimelineStore.getState();
      addTransition(transition);

      const state = useTimelineStore.getState();
      expect(state.transitions).toEqual([transition]);
    });

    it('should remove transition by id', () => {
      const { addTransition, removeTransitionById } = useTimelineStore.getState();
      addTransition(transition);
      removeTransitionById(transition.id);

      const state = useTimelineStore.getState();
      expect(state.transitions).toEqual([]);
    });

    it('should not add duplicate transitions', () => {
      const { addTransition } = useTimelineStore.getState();
      addTransition(transition);
      addTransition({ ...transition, id: 'transition-duplicate' });

      expect(useTimelineStore.getState().transitions).toHaveLength(1);
    });

    it('should update transition type and duration', () => {
      const { addTransition, updateTransition } = useTimelineStore.getState();
      addTransition(transition);
      updateTransition(transition.id, { type: 'dissolve', duration: 2.5 });

      expect(useTimelineStore.getState().transitions[0]).toMatchObject({
        type: 'dissolve',
        duration: 2.5,
      });
    });
  });
});
