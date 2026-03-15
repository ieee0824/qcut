import { describe, expect, it } from 'vitest';
import {
  getTransitionPlaybackPlan,
  getMonotonicPlaybackTime,
  getPlaybackTimelineTime,
  shouldCleanupTransitionPlayback,
} from '../components/VideoPreview/usePlaybackLoop';
import type { TransitionInfo } from '../components/VideoPreview/useTransitionEffect';

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

describe('getTransitionPlaybackPlan', () => {
  const transition: TransitionInfo = {
    outgoingClip: {
      id: 'clip-1',
      name: 'Clip 1',
      startTime: 0,
      duration: 5,
      filePath: 'a.mp4',
      sourceStartTime: 10,
      sourceEndTime: 15,
    },
    incomingClip: {
      id: 'clip-2',
      name: 'Clip 2',
      startTime: 5,
      duration: 5,
      filePath: 'b.mp4',
      sourceStartTime: 20,
      sourceEndTime: 25,
    },
    outTrackId: 'video-1',
    inTrackId: 'video-2',
    progress: 0.5,
    transitionType: 'crossfade',
    duration: 1,
  };

  it('computes outgoing and incoming source times for cross-track playback', () => {
    expect(
      getTransitionPlaybackPlan({
        transition,
        currentTime: 4.5,
        videoUrls: {
          'a.mp4': 'blob:outgoing',
          'b.mp4': 'blob:incoming',
        },
        loadedOutgoingUrl: null,
        loadedIncomingUrl: null,
        isLoadingOutgoing: false,
        isLoadingIncoming: false,
      }),
    ).toMatchObject({
      outgoingUrl: 'blob:outgoing',
      incomingUrl: 'blob:incoming',
      outgoingSourceTime: 14.5,
      incomingSourceTime: 20.5,
      shouldSwitchOutgoing: true,
      shouldSwitchIncoming: true,
    });
  });

  it('skips switching when both transition videos are already loaded', () => {
    expect(
      getTransitionPlaybackPlan({
        transition,
        currentTime: 4.5,
        videoUrls: {
          'a.mp4': 'blob:outgoing',
          'b.mp4': 'blob:incoming',
        },
        loadedOutgoingUrl: 'blob:outgoing',
        loadedIncomingUrl: 'blob:incoming',
        isLoadingOutgoing: false,
        isLoadingIncoming: false,
      }),
    ).toMatchObject({
      shouldSwitchOutgoing: false,
      shouldSwitchIncoming: false,
    });
  });

  it('avoids switching while a transition video is still loading', () => {
    expect(
      getTransitionPlaybackPlan({
        transition,
        currentTime: 4.5,
        videoUrls: {
          'a.mp4': 'blob:outgoing',
          'b.mp4': 'blob:incoming',
        },
        loadedOutgoingUrl: null,
        loadedIncomingUrl: null,
        isLoadingOutgoing: true,
        isLoadingIncoming: true,
      }),
    ).toMatchObject({
      shouldSwitchOutgoing: false,
      shouldSwitchIncoming: false,
    });
  });
});

describe('shouldCleanupTransitionPlayback', () => {
  it('cleans up after leaving a transition window', () => {
    expect(shouldCleanupTransitionPlayback(true, null)).toBe(true);
  });

  it('keeps transition state while a transition is still active', () => {
    const activeTransition: TransitionInfo = {
      outgoingClip: {
        id: 'clip-1',
        name: 'Clip 1',
        startTime: 0,
        duration: 5,
        filePath: 'a.mp4',
        sourceStartTime: 0,
        sourceEndTime: 5,
      },
      incomingClip: {
        id: 'clip-2',
        name: 'Clip 2',
        startTime: 5,
        duration: 5,
        filePath: 'b.mp4',
        sourceStartTime: 0,
        sourceEndTime: 5,
      },
      outTrackId: 'video-1',
      inTrackId: 'video-2',
      progress: 0.25,
      transitionType: 'wipe-left',
      duration: 1,
    };

    expect(shouldCleanupTransitionPlayback(true, activeTransition)).toBe(false);
    expect(shouldCleanupTransitionPlayback(false, null)).toBe(false);
  });
});
