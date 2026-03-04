import { describe, it, expect, beforeEach } from 'vitest';
import { useTimelineStore } from '../store/timelineStore';

describe('timelineStore', () => {
  beforeEach(() => {
    // Reset store before each test
    const state = useTimelineStore.getState();
    state.tracks.forEach(track => {
      track.clips = [];
    });
  });

  it('should have initial state', () => {
    const state = useTimelineStore.getState();
    expect(state.pixelsPerSecond).toBe(50);
    expect(state.currentTime).toBe(0);
    expect(state.isPlaying).toBe(false);
    expect(state.tracks).toHaveLength(3);
  });

  it('should add clip to track', () => {
    const { addClip } = useTimelineStore.getState();
    
    addClip('video-1', {
      id: 'test-clip',
      name: 'Test Clip',
      startTime: 0,
      duration: 5,
    });

    const state = useTimelineStore.getState();
    const track = state.tracks.find(t => t.id === 'video-1');
    expect(track.clips).toHaveLength(1);
    expect(track.clips[0].id).toBe('test-clip');
  });

  it('should remove clip from track', () => {
    const { addClip, removeClip } = useTimelineStore.getState();
    
    addClip('video-1', {
      id: 'test-clip',
      name: 'Test Clip',
      startTime: 0,
      duration: 5,
    });

    removeClip('video-1', 'test-clip');

    const state = useTimelineStore.getState();
    const track = state.tracks.find(t => t.id === 'video-1');
    expect(track.clips).toHaveLength(0);
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
});
