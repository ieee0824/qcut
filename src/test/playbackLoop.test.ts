import { describe, expect, it } from 'vitest';
import {
  getMonotonicPlaybackTime,
  getPlaybackTimelineTime,
} from '../components/VideoPreview/usePlaybackLoop';

describe('getMonotonicPlaybackTime', () => {
  it('keeps playback monotonic when decoder reports an earlier time', () => {
    expect(getMonotonicPlaybackTime(5.02, 4.98)).toBe(5.02);
  });

  it('allows normal forward playback', () => {
    expect(getMonotonicPlaybackTime(5.02, 5.08)).toBe(5.08);
  });
});

describe('getPlaybackTimelineTime', () => {
  it('does not rewind when the first decoded frame of the next clip starts slightly earlier', () => {
    expect(
      getPlaybackTimelineTime({
        previousTimelineTime: 5.02,
        clipStartTime: 5,
        clipSourceStartTime: 0,
        videoSourceTime: 0.01,
      }),
    ).toBe(5.02);
  });

  it('advances normally after the clip switch settles', () => {
    expect(
      getPlaybackTimelineTime({
        previousTimelineTime: 5.02,
        clipStartTime: 5,
        clipSourceStartTime: 0,
        videoSourceTime: 0.08,
      }),
    ).toBe(5.08);
  });
});
