import { describe, expect, it } from 'vitest';
import {
  splitClip,
  upsertKeyframe,
  removeKeyframeAtTime,
  updateKeyframeEasingAtTime,
  moveKeyframeTime,
  deduplicateByTime,
} from '../utils/clipOperations';
import type { Clip, Keyframe } from '../store/timeline/types';

function makeClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'clip-1',
    name: 'Test Clip',
    startTime: 10,
    duration: 6,
    filePath: '/test/video.mp4',
    sourceStartTime: 0,
    sourceEndTime: 6,
    ...overrides,
  };
}

function makeKeyframe(time: number, value: number, easing: Keyframe['easing'] = 'linear'): Keyframe {
  return { time, value, easing };
}

// ------------------------------------------------------------------
// splitClip
// ------------------------------------------------------------------
describe('splitClip', () => {
  it('splits a clip into two at the given timeline time', () => {
    const clip = makeClip();
    const result = splitClip(clip, 13); // 10 + 3 = split at relative 3s

    expect(result).not.toBeNull();
    const [first, second] = result!;

    expect(first.id).toBe('clip-1-1');
    expect(first.startTime).toBe(10);
    expect(first.duration).toBe(3);
    expect(first.sourceStartTime).toBe(0);
    expect(first.sourceEndTime).toBe(3);

    expect(second.id).toBe('clip-1-2');
    expect(second.startTime).toBe(13);
    expect(second.duration).toBe(3);
    expect(second.sourceStartTime).toBe(3);
    expect(second.sourceEndTime).toBe(6);
  });

  it('returns null when splitTime is at or before clip start', () => {
    const clip = makeClip();
    expect(splitClip(clip, 10)).toBeNull();
    expect(splitClip(clip, 9)).toBeNull();
  });

  it('returns null when splitTime is at or after clip end', () => {
    const clip = makeClip();
    expect(splitClip(clip, 16)).toBeNull();
    expect(splitClip(clip, 17)).toBeNull();
  });

  it('does not mutate the original clip', () => {
    const effects = { brightness: 1.5 } as Clip['effects'];
    const clip = makeClip({ effects });
    const originalEffects = clip.effects;
    splitClip(clip, 13);
    expect(clip.effects).toBe(originalEffects); // 参照が変わっていないこと
    expect(clip.id).toBe('clip-1');
    expect(clip.duration).toBe(6);
  });

  it('produces deep copies: first and second do not share nested references', () => {
    const clip = makeClip({
      effects: { brightness: 1.5 } as Clip['effects'],
      keyframes: { brightness: [{ time: 1, value: 2, easing: 'linear' as const }] },
      transition: { type: 'crossfade', duration: 0.5 },
    });
    const [first, second] = splitClip(clip, 13)!;

    // 値は同じだが参照は独立
    expect(first.effects).toEqual(second.effects);
    expect(first.effects).not.toBe(second.effects);

    expect(first.keyframes).toEqual(second.keyframes);
    expect(first.keyframes).not.toBe(second.keyframes);

    expect(first.transition).toEqual(second.transition);
    expect(first.transition).not.toBe(second.transition);

    // 元の clip とも独立
    expect(first.effects).not.toBe(clip.effects);
    expect(second.effects).not.toBe(clip.effects);
  });

  it('correctly computes source times when sourceStartTime is non-zero', () => {
    const clip = makeClip({
      sourceStartTime: 5,
      sourceEndTime: 11,
    });
    const [first, second] = splitClip(clip, 13)!; // relative 3s

    expect(first.sourceStartTime).toBe(5);
    expect(first.sourceEndTime).toBe(8);   // 5 + 3

    expect(second.sourceStartTime).toBe(8); // 5 + 3
    expect(second.sourceEndTime).toBe(11);
  });
});

// ------------------------------------------------------------------
// upsertKeyframe
// ------------------------------------------------------------------
describe('upsertKeyframe', () => {
  it('appends a keyframe to an empty list', () => {
    const kf = makeKeyframe(1.0, 50);
    const result = upsertKeyframe([], kf);
    expect(result).toEqual([kf]);
  });

  it('replaces a keyframe at the same time (within tolerance)', () => {
    const existing = [makeKeyframe(1.0, 50), makeKeyframe(2.0, 80)];
    const updated = makeKeyframe(1.0005, 70, 'easeIn');
    const result = upsertKeyframe(existing, updated);
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(70);
    expect(result[0].easing).toBe('easeIn');
  });

  it('maintains sorted order by time', () => {
    const existing = [makeKeyframe(1.0, 50), makeKeyframe(3.0, 80)];
    const middle = makeKeyframe(2.0, 65);
    const result = upsertKeyframe(existing, middle);
    expect(result.map(kf => kf.time)).toEqual([1.0, 2.0, 3.0]);
  });

  it('does not mutate the input array', () => {
    const existing = [makeKeyframe(1.0, 50)];
    const originalLength = existing.length;
    upsertKeyframe(existing, makeKeyframe(2.0, 80));
    expect(existing).toHaveLength(originalLength);
  });
});

// ------------------------------------------------------------------
// removeKeyframeAtTime
// ------------------------------------------------------------------
describe('removeKeyframeAtTime', () => {
  it('removes the keyframe at the given time (within tolerance)', () => {
    const existing = [makeKeyframe(1.0, 50), makeKeyframe(2.0, 80)];
    const result = removeKeyframeAtTime(existing, 1.0005);
    expect(result).toHaveLength(1);
    expect(result[0].time).toBe(2.0);
  });

  it('returns a copy when no keyframe matches', () => {
    const existing = [makeKeyframe(1.0, 50)];
    const result = removeKeyframeAtTime(existing, 5.0);
    expect(result).toHaveLength(1);
    expect(result).not.toBe(existing);
  });

  it('does not mutate the input array', () => {
    const existing = [makeKeyframe(1.0, 50), makeKeyframe(2.0, 80)];
    removeKeyframeAtTime(existing, 1.0);
    expect(existing).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(removeKeyframeAtTime([], 1.0)).toEqual([]);
  });
});

// ------------------------------------------------------------------
// updateKeyframeEasingAtTime
// ------------------------------------------------------------------
describe('updateKeyframeEasingAtTime', () => {
  it('updates the easing of the keyframe at the given time', () => {
    const existing = [makeKeyframe(1.0, 50, 'linear'), makeKeyframe(2.0, 80, 'linear')];
    const result = updateKeyframeEasingAtTime(existing, 1.0, 'easeInOut');
    expect(result[0].easing).toBe('easeInOut');
    expect(result[1].easing).toBe('linear');
  });

  it('does not modify keyframes at other times', () => {
    const existing = [makeKeyframe(1.0, 50), makeKeyframe(2.0, 80)];
    const result = updateKeyframeEasingAtTime(existing, 1.0, 'easeIn');
    expect(result[1].value).toBe(80);
    expect(result[1].easing).toBe('linear');
  });

  it('does not mutate the input array or its elements', () => {
    const existing = [makeKeyframe(1.0, 50, 'linear')];
    updateKeyframeEasingAtTime(existing, 1.0, 'easeOut');
    expect(existing[0].easing).toBe('linear');
  });

  it('returns unchanged copy when no keyframe matches', () => {
    const existing = [makeKeyframe(1.0, 50, 'linear')];
    const result = updateKeyframeEasingAtTime(existing, 9.0, 'easeIn');
    expect(result).toEqual(existing);
    expect(result).not.toBe(existing);
  });

  it('returns empty array for empty input', () => {
    expect(updateKeyframeEasingAtTime([], 1.0, 'easeIn')).toEqual([]);
  });
});

// ------------------------------------------------------------------
// moveKeyframeTime
// ------------------------------------------------------------------
describe('moveKeyframeTime', () => {
  it('moves a keyframe from one time to another', () => {
    const existing = [makeKeyframe(1.0, 50), makeKeyframe(3.0, 80)];
    const result = moveKeyframeTime(existing, 1.0, 2.0);
    expect(result.map(kf => kf.time)).toEqual([2.0, 3.0]);
    expect(result[0].value).toBe(50);
  });

  it('when moved onto an existing keyframe, the moved one wins', () => {
    const existing = [makeKeyframe(1.0, 50), makeKeyframe(2.0, 80)];
    const result = moveKeyframeTime(existing, 1.0, 2.0);
    expect(result).toHaveLength(1);
    // ドラッグ操作: 移動した側 (value=50) が既存 (value=80) を上書きする
    expect(result[0].value).toBe(50);
  });

  it('maintains sorted order after move', () => {
    const existing = [makeKeyframe(1.0, 10), makeKeyframe(2.0, 20), makeKeyframe(5.0, 50)];
    const result = moveKeyframeTime(existing, 5.0, 1.5);
    expect(result.map(kf => kf.time)).toEqual([1.0, 1.5, 2.0]);
  });

  it('does not mutate the input array', () => {
    const existing = [makeKeyframe(1.0, 50), makeKeyframe(3.0, 80)];
    moveKeyframeTime(existing, 1.0, 2.0);
    expect(existing[0].time).toBe(1.0);
  });

  it('returns unchanged copy when fromTime matches no keyframe', () => {
    const existing = [makeKeyframe(1.0, 50), makeKeyframe(3.0, 80)];
    const result = moveKeyframeTime(existing, 9.0, 2.0);
    expect(result).toEqual(existing);
  });

  it('returns empty array for empty input', () => {
    expect(moveKeyframeTime([], 1.0, 2.0)).toEqual([]);
  });

  it('is a no-op when fromTime equals toTime', () => {
    const existing = [makeKeyframe(1.0, 50), makeKeyframe(3.0, 80)];
    const result = moveKeyframeTime(existing, 1.0, 1.0);
    expect(result).toEqual(existing);
  });
});

// ------------------------------------------------------------------
// deduplicateByTime
// ------------------------------------------------------------------
describe('deduplicateByTime', () => {
  it('returns empty array for empty input', () => {
    expect(deduplicateByTime([])).toEqual([]);
  });

  it('returns single-element array unchanged', () => {
    const input = [makeKeyframe(1.0, 50)];
    expect(deduplicateByTime(input)).toEqual(input);
  });

  it('keeps the later element when two have the same time', () => {
    const input = [makeKeyframe(2.0, 50), makeKeyframe(2.0, 80)];
    const result = deduplicateByTime(input);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(80);
  });

  it('keeps the last when three or more share the same time', () => {
    const input = [makeKeyframe(1.0, 10), makeKeyframe(1.0, 20), makeKeyframe(1.0, 30)];
    const result = deduplicateByTime(input);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(30);
  });

  it('preserves distinct-time elements in order', () => {
    const input = [makeKeyframe(1.0, 10), makeKeyframe(2.0, 20), makeKeyframe(3.0, 30)];
    const result = deduplicateByTime(input);
    expect(result).toEqual(input);
  });

  it('deduplicates only adjacent same-time groups', () => {
    const input = [
      makeKeyframe(1.0, 10),
      makeKeyframe(1.0, 11),
      makeKeyframe(3.0, 30),
      makeKeyframe(3.0, 31),
    ];
    const result = deduplicateByTime(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(makeKeyframe(1.0, 11));
    expect(result[1]).toEqual(makeKeyframe(3.0, 31));
  });

  it('does not mutate the input array', () => {
    const input = [makeKeyframe(1.0, 50), makeKeyframe(1.0, 80)];
    deduplicateByTime(input);
    expect(input).toHaveLength(2);
  });
});
