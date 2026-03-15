import { describe, it, expect, beforeEach } from 'vitest';
import { useTimelineStore, type TransitionType } from '../store/timelineStore';
import { findTransitionAtTime } from '../utils/transitionInfo';

/**
 * トランジション再生ロジックのユニットテスト
 * VideoPreview内のヘルパー関数のロジックを再現してテスト
 */

// getTransitionStyles のロジックを再現
function getTransitionStyles(progress: number, type: TransitionType) {
  switch (type) {
    case 'crossfade':
    case 'dissolve':
      return {
        outgoing: { opacity: 1 - progress },
        incoming: { opacity: progress },
      };
    case 'wipe-left':
      return {
        outgoing: {},
        incoming: { clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` },
      };
    case 'wipe-right':
      return {
        outgoing: {},
        incoming: { clipPath: `inset(0 0 0 ${(1 - progress) * 100}%)` },
      };
    case 'wipe-up':
      return {
        outgoing: {},
        incoming: { clipPath: `inset(0 0 ${(1 - progress) * 100}% 0)` },
      };
    case 'wipe-down':
      return {
        outgoing: {},
        incoming: { clipPath: `inset(${(1 - progress) * 100}% 0 0 0)` },
      };
    default:
      return {
        outgoing: { opacity: 1 - progress },
        incoming: { opacity: progress },
      };
  }
}

describe('transition playback logic', () => {
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

    const { addTrack, addClip, addTransition } = useTimelineStore.getState();
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
    addTransition({
      id: 'transition-clip-1-clip-2',
      type: 'crossfade',
      duration: 1.0,
      outTrackId: 'video-1',
      outClipId: 'clip-1',
      inTrackId: 'video-1',
      inClipId: 'clip-2',
    });
  });

  describe('findTransitionAtTime', () => {
    it('should return null before transition zone', () => {
      const { tracks, transitions } = useTimelineStore.getState();
      expect(findTransitionAtTime(tracks, transitions, 3.0)).toBeNull();
    });

    it('should detect transition at overlap start', () => {
      const { tracks, transitions } = useTimelineStore.getState();
      const result = findTransitionAtTime(tracks, transitions, 4.0);
      expect(result).not.toBeNull();
      expect(result!.outgoingClip.id).toBe('clip-1');
      expect(result!.incomingClip.id).toBe('clip-2');
      expect(result!.outTrackId).toBe('video-1');
      expect(result!.inTrackId).toBe('video-1');
      expect(result!.progress).toBeCloseTo(0);
    });

    it('should detect transition at midpoint', () => {
      const { tracks, transitions } = useTimelineStore.getState();
      const result = findTransitionAtTime(tracks, transitions, 4.5);
      expect(result).not.toBeNull();
      expect(result!.progress).toBeCloseTo(0.5);
    });

    it('should detect transition near end', () => {
      const { tracks, transitions } = useTimelineStore.getState();
      const result = findTransitionAtTime(tracks, transitions, 4.9);
      expect(result).not.toBeNull();
      expect(result!.progress).toBeCloseTo(0.9);
    });

    it('should return null after transition zone', () => {
      const { tracks, transitions } = useTimelineStore.getState();
      expect(findTransitionAtTime(tracks, transitions, 5.0)).toBeNull();
    });

    it('should return null when no transition is set', () => {
      const { removeTransitionById } = useTimelineStore.getState();
      removeTransitionById('transition-clip-1-clip-2');
      const { tracks, transitions } = useTimelineStore.getState();
      expect(findTransitionAtTime(tracks, transitions, 4.5)).toBeNull();
    });

    it('should detect cross-track transition and include track ids', () => {
      const { addTrack, addClip, addTransition, removeTransitionById } = useTimelineStore.getState();
      removeTransitionById('transition-clip-1-clip-2');
      addTrack({ id: 'video-2', type: 'video', name: 'Video 2', clips: [] });
      addClip('video-2', {
        id: 'clip-3',
        name: 'Clip 3',
        startTime: 5,
        duration: 5,
        filePath: 'c.mp4',
        sourceStartTime: 0,
        sourceEndTime: 5,
      });
      addTransition({
        id: 'transition-cross-track',
        type: 'dissolve',
        duration: 1.0,
        outTrackId: 'video-1',
        outClipId: 'clip-1',
        inTrackId: 'video-2',
        inClipId: 'clip-3',
      });

      const { tracks, transitions } = useTimelineStore.getState();
      const result = findTransitionAtTime(tracks, transitions, 4.5, () =>
        tracks.find((track) => track.id === 'video-1')?.clips.find((clip) => clip.id === 'clip-1') ?? null,
      );

      expect(result).not.toBeNull();
      expect(result!.outTrackId).toBe('video-1');
      expect(result!.inTrackId).toBe('video-2');
      expect(result!.transitionType).toBe('dissolve');
    });
  });

  describe('getTransitionStyles', () => {
    it('should compute crossfade opacity correctly', () => {
      const styles = getTransitionStyles(0.5, 'crossfade');
      expect(styles.outgoing.opacity).toBeCloseTo(0.5);
      expect(styles.incoming.opacity).toBeCloseTo(0.5);
    });

    it('should compute crossfade at start', () => {
      const styles = getTransitionStyles(0, 'crossfade');
      expect(styles.outgoing.opacity).toBeCloseTo(1);
      expect(styles.incoming.opacity).toBeCloseTo(0);
    });

    it('should compute crossfade at end', () => {
      const styles = getTransitionStyles(1, 'crossfade');
      expect(styles.outgoing.opacity).toBeCloseTo(0);
      expect(styles.incoming.opacity).toBeCloseTo(1);
    });

    it('should compute wipe-left clip-path', () => {
      const styles = getTransitionStyles(0.5, 'wipe-left');
      expect(styles.incoming.clipPath).toBe('inset(0 50% 0 0)');
    });

    it('should compute wipe-right clip-path', () => {
      const styles = getTransitionStyles(0.5, 'wipe-right');
      expect(styles.incoming.clipPath).toBe('inset(0 0 0 50%)');
    });

    it('should compute wipe-up clip-path', () => {
      const styles = getTransitionStyles(0.5, 'wipe-up');
      expect(styles.incoming.clipPath).toBe('inset(0 0 50% 0)');
    });

    it('should compute wipe-down clip-path', () => {
      const styles = getTransitionStyles(0.5, 'wipe-down');
      expect(styles.incoming.clipPath).toBe('inset(50% 0 0 0)');
    });

    it('should treat dissolve same as crossfade', () => {
      const styles = getTransitionStyles(0.5, 'dissolve');
      expect(styles.outgoing.opacity).toBeCloseTo(0.5);
      expect(styles.incoming.opacity).toBeCloseTo(0.5);
    });
  });
});
