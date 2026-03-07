import { describe, it, expect, beforeEach } from 'vitest';
import { useTimelineStore, DEFAULT_EFFECTS } from '../store/timelineStore';

/**
 * フェードイン/フェードアウトエフェクトのテスト
 * ClipEffects の fadeIn/fadeOut による opacity 計算ロジックを検証
 */

// VideoPreview 内のフェード opacity 計算ロジックを再現
function computeFadeOpacity(
  currentTime: number,
  clipStartTime: number,
  clipEndTime: number,
  fadeIn: number,
  fadeOut: number,
): number {
  const elapsed = currentTime - clipStartTime;
  const remaining = clipEndTime - currentTime;
  let opacity = 1;
  if (fadeIn > 0 && elapsed < fadeIn) {
    opacity = Math.min(opacity, elapsed / fadeIn);
  }
  if (fadeOut > 0 && remaining < fadeOut) {
    opacity = Math.min(opacity, remaining / fadeOut);
  }
  return Math.max(0, Math.min(1, opacity));
}

describe('fade effect', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      tracks: [],
      selectedClipId: null,
      selectedTrackId: null,
      currentTime: 0,
      isPlaying: false,
      pixelsPerSecond: 50,
    });
  });

  it('should have fadeIn and fadeOut in DEFAULT_EFFECTS', () => {
    expect(DEFAULT_EFFECTS.fadeIn).toBe(0);
    expect(DEFAULT_EFFECTS.fadeOut).toBe(0);
  });

  it('should store fadeIn/fadeOut in clip effects', () => {
    const { addTrack, addClip, updateClip } = useTimelineStore.getState();
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

    updateClip('video-1', 'clip-1', {
      effects: { ...DEFAULT_EFFECTS, fadeIn: 1.0, fadeOut: 0.5 },
    });

    const state = useTimelineStore.getState();
    const clip = state.tracks[0].clips[0];
    expect(clip.effects?.fadeIn).toBe(1.0);
    expect(clip.effects?.fadeOut).toBe(0.5);
  });

  describe('opacity calculation', () => {
    // clip: startTime=0, endTime=10, fadeIn=2, fadeOut=1

    it('should return 0 at clip start with fadeIn', () => {
      expect(computeFadeOpacity(0, 0, 10, 2, 0)).toBe(0);
    });

    it('should return 0.5 at halfway through fadeIn', () => {
      expect(computeFadeOpacity(1, 0, 10, 2, 0)).toBe(0.5);
    });

    it('should return 1 after fadeIn completes', () => {
      expect(computeFadeOpacity(2, 0, 10, 2, 0)).toBe(1);
      expect(computeFadeOpacity(5, 0, 10, 2, 0)).toBe(1);
    });

    it('should return 1 before fadeOut starts', () => {
      expect(computeFadeOpacity(5, 0, 10, 0, 1)).toBe(1);
    });

    it('should return 0.5 at halfway through fadeOut', () => {
      expect(computeFadeOpacity(9.5, 0, 10, 0, 1)).toBe(0.5);
    });

    it('should return 0 at clip end with fadeOut', () => {
      expect(computeFadeOpacity(10, 0, 10, 0, 1)).toBe(0);
    });

    it('should handle overlapping fadeIn and fadeOut', () => {
      // clip duration=2, fadeIn=1.5, fadeOut=1.5 → overlap in middle
      // at t=0.5: fadeIn progress = 0.5/1.5 ≈ 0.333, remaining=1.5 → fadeOut not active
      const opacity = computeFadeOpacity(0.5, 0, 2, 1.5, 1.5);
      expect(opacity).toBeCloseTo(0.333, 2);
    });

    it('should return 1 when no fade is set', () => {
      expect(computeFadeOpacity(5, 0, 10, 0, 0)).toBe(1);
    });
  });
});
