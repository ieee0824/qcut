import { describe, it, expect, beforeEach } from 'vitest';
import { useTimelineStore, type TransitionType } from '../store/timelineStore';

/**
 * トランジション再生ロジックのユニットテスト
 * VideoPreview内のヘルパー関数のロジックを再現してテスト
 */

// findTransitionAtTime のロジックを再現
function findTransitionAtTime(time: number) {
  const tracks = useTimelineStore.getState().tracks;
  for (const track of tracks) {
    if (track.type !== 'video') continue;
    for (const clip of track.clips) {
      if (!clip.transition) continue;
      const overlapStart = clip.startTime - clip.transition.duration;
      const overlapEnd = clip.startTime;
      if (time >= overlapStart && time < overlapEnd) {
        // outgoing clip を探す
        let outgoing = null;
        for (const t of tracks) {
          if (t.type !== 'video') continue;
          for (const c of t.clips) {
            if (time >= c.startTime && time < c.startTime + c.duration) {
              outgoing = c;
              break;
            }
          }
        }
        if (!outgoing || outgoing.id === clip.id) continue;
        const progress = (time - overlapStart) / clip.transition.duration;
        return {
          outgoingClip: outgoing,
          incomingClip: clip,
          progress,
          transitionType: clip.transition.type,
        };
      }
    }
  }
  return null;
}

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
      selectedClipId: null,
      selectedTrackId: null,
      currentTime: 0,
      isPlaying: false,
      pixelsPerSecond: 50,
    });

    const { addTrack, addClip, setTransition } = useTimelineStore.getState();
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
    setTransition('video-1', 'clip-2', { type: 'crossfade', duration: 1.0 });
  });

  describe('findTransitionAtTime', () => {
    it('should return null before transition zone', () => {
      expect(findTransitionAtTime(3.0)).toBeNull();
    });

    it('should detect transition at overlap start', () => {
      const result = findTransitionAtTime(4.0);
      expect(result).not.toBeNull();
      expect(result!.outgoingClip.id).toBe('clip-1');
      expect(result!.incomingClip.id).toBe('clip-2');
      expect(result!.progress).toBeCloseTo(0);
    });

    it('should detect transition at midpoint', () => {
      const result = findTransitionAtTime(4.5);
      expect(result).not.toBeNull();
      expect(result!.progress).toBeCloseTo(0.5);
    });

    it('should detect transition near end', () => {
      const result = findTransitionAtTime(4.9);
      expect(result).not.toBeNull();
      expect(result!.progress).toBeCloseTo(0.9);
    });

    it('should return null after transition zone', () => {
      expect(findTransitionAtTime(5.0)).toBeNull();
    });

    it('should return null when no transition is set', () => {
      const { removeTransition } = useTimelineStore.getState();
      removeTransition('video-1', 'clip-2');
      expect(findTransitionAtTime(4.5)).toBeNull();
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
