import { describe, it, expect, beforeEach } from 'vitest';
import { useTimelineStore } from '../store/timelineStore';
import type { CrossTrackTransition } from '../store/timelineStore';

describe('cross-track transition', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      tracks: [],
      crossTrackTransitions: [],
      selectedClipId: null,
      selectedTrackId: null,
      currentTime: 0,
      isPlaying: false,
      pixelsPerSecond: 50,
    });

    const { addTrack, addClip } = useTimelineStore.getState();
    addTrack({ id: 'video-1', type: 'video', name: 'Video 1', clips: [] });
    addTrack({ id: 'video-2', type: 'video', name: 'Video 2', clips: [] });

    // Video 1: clip at 0-5s
    addClip('video-1', {
      id: 'clip-1',
      name: 'Clip 1',
      startTime: 0,
      duration: 5,
      filePath: 'a.mp4',
      sourceStartTime: 0,
      sourceEndTime: 5,
    });
    // Video 2: clip at 3-8s (overlaps with clip-1 from 3-5s)
    addClip('video-2', {
      id: 'clip-2',
      name: 'Clip 2',
      startTime: 3,
      duration: 5,
      filePath: 'b.mp4',
      sourceStartTime: 0,
      sourceEndTime: 5,
    });
  });

  const makeCrossTransition = (overrides?: Partial<CrossTrackTransition>): CrossTrackTransition => ({
    id: 'ct-1',
    type: 'crossfade',
    duration: 1.0,
    sourceTrackId: 'video-1',
    sourceClipId: 'clip-1',
    targetTrackId: 'video-2',
    targetClipId: 'clip-2',
    ...overrides,
  });

  describe('addCrossTrackTransition', () => {
    it('should add a cross-track transition between overlapping clips', () => {
      const { addCrossTrackTransition } = useTimelineStore.getState();
      addCrossTrackTransition(makeCrossTransition());

      const state = useTimelineStore.getState();
      expect(state.crossTrackTransitions).toHaveLength(1);
      expect(state.crossTrackTransitions[0].id).toBe('ct-1');
      expect(state.crossTrackTransitions[0].type).toBe('crossfade');
    });

    it('should reject transition between clips on the same track', () => {
      const { addCrossTrackTransition } = useTimelineStore.getState();
      addCrossTrackTransition(makeCrossTransition({
        sourceTrackId: 'video-1',
        targetTrackId: 'video-1',
      }));

      const state = useTimelineStore.getState();
      expect(state.crossTrackTransitions).toHaveLength(0);
    });

    it('should reject transition between non-overlapping clips', () => {
      // Add a non-overlapping clip on video-2
      const { addClip, addCrossTrackTransition } = useTimelineStore.getState();
      addClip('video-2', {
        id: 'clip-3',
        name: 'Clip 3',
        startTime: 10,
        duration: 5,
        filePath: 'c.mp4',
        sourceStartTime: 0,
        sourceEndTime: 5,
      });

      addCrossTrackTransition(makeCrossTransition({
        targetClipId: 'clip-3',
      }));

      const state = useTimelineStore.getState();
      expect(state.crossTrackTransitions).toHaveLength(0);
    });

    it('should reject transition when clips do not exist', () => {
      const { addCrossTrackTransition } = useTimelineStore.getState();
      addCrossTrackTransition(makeCrossTransition({
        sourceClipId: 'nonexistent',
      }));

      const state = useTimelineStore.getState();
      expect(state.crossTrackTransitions).toHaveLength(0);
    });
  });

  describe('removeCrossTrackTransition', () => {
    it('should remove a cross-track transition by id', () => {
      const { addCrossTrackTransition, removeCrossTrackTransition } = useTimelineStore.getState();
      addCrossTrackTransition(makeCrossTransition());
      removeCrossTrackTransition('ct-1');

      const state = useTimelineStore.getState();
      expect(state.crossTrackTransitions).toHaveLength(0);
    });
  });

  describe('updateCrossTrackTransition', () => {
    it('should update type and duration', () => {
      const { addCrossTrackTransition, updateCrossTrackTransition } = useTimelineStore.getState();
      addCrossTrackTransition(makeCrossTransition());
      updateCrossTrackTransition('ct-1', { type: 'dissolve', duration: 2.0 });

      const state = useTimelineStore.getState();
      expect(state.crossTrackTransitions[0].type).toBe('dissolve');
      expect(state.crossTrackTransitions[0].duration).toBe(2.0);
    });
  });

  describe('cascade deletion', () => {
    beforeEach(() => {
      const { addCrossTrackTransition } = useTimelineStore.getState();
      addCrossTrackTransition(makeCrossTransition());
    });

    it('should remove cross-track transition when source clip is removed', () => {
      const { removeClip } = useTimelineStore.getState();
      removeClip('video-1', 'clip-1');

      const state = useTimelineStore.getState();
      expect(state.crossTrackTransitions).toHaveLength(0);
    });

    it('should remove cross-track transition when target clip is removed', () => {
      const { removeClip } = useTimelineStore.getState();
      removeClip('video-2', 'clip-2');

      const state = useTimelineStore.getState();
      expect(state.crossTrackTransitions).toHaveLength(0);
    });

    it('should remove cross-track transition when source track is removed', () => {
      const { removeTrack } = useTimelineStore.getState();
      removeTrack('video-1');

      const state = useTimelineStore.getState();
      expect(state.crossTrackTransitions).toHaveLength(0);
    });

    it('should remove cross-track transition when target track is removed', () => {
      const { removeTrack } = useTimelineStore.getState();
      removeTrack('video-2');

      const state = useTimelineStore.getState();
      expect(state.crossTrackTransitions).toHaveLength(0);
    });

    it('should remove cross-track transition when source clip is split', () => {
      const { splitClipAtTime } = useTimelineStore.getState();
      splitClipAtTime('video-1', 'clip-1', 2.5);

      const state = useTimelineStore.getState();
      expect(state.crossTrackTransitions).toHaveLength(0);
    });

    it('should remove cross-track transition when selected clip is deleted', () => {
      const { setSelectedClip, deleteSelectedClip } = useTimelineStore.getState();
      setSelectedClip('video-1', 'clip-1');
      deleteSelectedClip();

      const state = useTimelineStore.getState();
      expect(state.crossTrackTransitions).toHaveLength(0);
    });

    it('should not remove unrelated cross-track transitions', () => {
      // Add another clip and transition
      const { addClip, addCrossTrackTransition, removeClip } = useTimelineStore.getState();
      addClip('video-1', {
        id: 'clip-3',
        name: 'Clip 3',
        startTime: 3,
        duration: 5,
        filePath: 'c.mp4',
        sourceStartTime: 0,
        sourceEndTime: 5,
      });
      addCrossTrackTransition({
        id: 'ct-2',
        type: 'dissolve',
        duration: 1.0,
        sourceTrackId: 'video-1',
        sourceClipId: 'clip-3',
        targetTrackId: 'video-2',
        targetClipId: 'clip-2',
      });

      // Remove clip-1 should only remove ct-1
      removeClip('video-1', 'clip-1');

      const state = useTimelineStore.getState();
      expect(state.crossTrackTransitions).toHaveLength(1);
      expect(state.crossTrackTransitions[0].id).toBe('ct-2');
    });
  });
});
