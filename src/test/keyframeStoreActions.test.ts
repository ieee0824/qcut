import { describe, it, expect, beforeEach } from 'vitest';
import { useTimelineStore } from '../store/timelineStore';
import type { Clip } from '../store/timelineStore';

function resetStore() {
  useTimelineStore.setState({
    tracks: [],
    transitions: [],
    selectedClipId: null,
    selectedTrackId: null,
    currentTime: 0,
    isPlaying: false,
    pixelsPerSecond: 50,
    _history: [{ tracks: [], transitions: [] }],
    _historyIndex: 0,
    _clipboard: null,
  });
}

function setupClip(trackId = 'v1', clipId = 'clip-1') {
  const { addTrack, addClip } = useTimelineStore.getState();
  addTrack({ id: trackId, type: 'video', name: 'Video', clips: [] });
  addClip(trackId, {
    id: clipId,
    name: 'Clip',
    startTime: 0,
    duration: 10,
    filePath: 'test.mp4',
    sourceStartTime: 0,
    sourceEndTime: 10,
  });
}

function getClip(trackId = 'v1', clipId = 'clip-1'): Clip | undefined {
  return useTimelineStore.getState().tracks
    .find(t => t.id === trackId)?.clips
    .find(c => c.id === clipId);
}

describe('addKeyframe', () => {
  beforeEach(resetStore);

  it('should add a keyframe to the clip', () => {
    setupClip();
    useTimelineStore.getState().addKeyframe('v1', 'clip-1', 'brightness', { time: 1.0, value: 1.5, easing: 'linear' });
    const clip = getClip();
    expect(clip?.keyframes?.brightness).toHaveLength(1);
    expect(clip?.keyframes?.brightness?.[0].value).toBe(1.5);
  });

  it('should keep keyframes sorted by time', () => {
    setupClip();
    const { addKeyframe } = useTimelineStore.getState();
    addKeyframe('v1', 'clip-1', 'brightness', { time: 3.0, value: 2.0, easing: 'linear' });
    addKeyframe('v1', 'clip-1', 'brightness', { time: 1.0, value: 1.0, easing: 'linear' });
    const kfs = getClip()?.keyframes?.brightness ?? [];
    expect(kfs[0].time).toBe(1.0);
    expect(kfs[1].time).toBe(3.0);
  });

  it('should overwrite a keyframe at the same time', () => {
    setupClip();
    const { addKeyframe } = useTimelineStore.getState();
    addKeyframe('v1', 'clip-1', 'brightness', { time: 1.0, value: 1.5, easing: 'linear' });
    addKeyframe('v1', 'clip-1', 'brightness', { time: 1.0, value: 2.0, easing: 'easeIn' });
    const kfs = getClip()?.keyframes?.brightness ?? [];
    expect(kfs).toHaveLength(1);
    expect(kfs[0].value).toBe(2.0);
    expect(kfs[0].easing).toBe('easeIn');
  });

  it('should support multiple effect keys independently', () => {
    setupClip();
    const { addKeyframe } = useTimelineStore.getState();
    addKeyframe('v1', 'clip-1', 'brightness', { time: 0.0, value: 1.0, easing: 'linear' });
    addKeyframe('v1', 'clip-1', 'contrast', { time: 0.0, value: 0.5, easing: 'linear' });
    const clip = getClip();
    expect(clip?.keyframes?.brightness).toHaveLength(1);
    expect(clip?.keyframes?.contrast).toHaveLength(1);
  });
});

describe('removeKeyframe', () => {
  beforeEach(resetStore);

  it('should remove a keyframe by time', () => {
    setupClip();
    const { addKeyframe, removeKeyframe } = useTimelineStore.getState();
    addKeyframe('v1', 'clip-1', 'brightness', { time: 1.0, value: 1.5, easing: 'linear' });
    addKeyframe('v1', 'clip-1', 'brightness', { time: 2.0, value: 2.0, easing: 'linear' });
    removeKeyframe('v1', 'clip-1', 'brightness', 1.0);
    const kfs = getClip()?.keyframes?.brightness ?? [];
    expect(kfs).toHaveLength(1);
    expect(kfs[0].time).toBe(2.0);
  });

  it('should delete the effect key when the last keyframe is removed', () => {
    setupClip();
    const { addKeyframe, removeKeyframe } = useTimelineStore.getState();
    addKeyframe('v1', 'clip-1', 'brightness', { time: 1.0, value: 1.5, easing: 'linear' });
    removeKeyframe('v1', 'clip-1', 'brightness', 1.0);
    expect(getClip()?.keyframes?.brightness).toBeUndefined();
  });

  it('should set keyframes to undefined when all keys are removed', () => {
    setupClip();
    const { addKeyframe, removeKeyframe } = useTimelineStore.getState();
    addKeyframe('v1', 'clip-1', 'brightness', { time: 1.0, value: 1.5, easing: 'linear' });
    removeKeyframe('v1', 'clip-1', 'brightness', 1.0);
    expect(getClip()?.keyframes).toBeUndefined();
  });
});

describe('updateKeyframeEasing', () => {
  beforeEach(resetStore);

  it('should update the easing of a keyframe', () => {
    setupClip();
    const { addKeyframe, updateKeyframeEasing } = useTimelineStore.getState();
    addKeyframe('v1', 'clip-1', 'brightness', { time: 1.0, value: 1.5, easing: 'linear' });
    updateKeyframeEasing('v1', 'clip-1', 'brightness', 1.0, 'easeIn');
    expect(getClip()?.keyframes?.brightness?.[0].easing).toBe('easeIn');
  });

  it('should not affect other keyframes', () => {
    setupClip();
    const { addKeyframe, updateKeyframeEasing } = useTimelineStore.getState();
    addKeyframe('v1', 'clip-1', 'brightness', { time: 0.0, value: 1.0, easing: 'linear' });
    addKeyframe('v1', 'clip-1', 'brightness', { time: 2.0, value: 2.0, easing: 'linear' });
    updateKeyframeEasing('v1', 'clip-1', 'brightness', 0.0, 'easeOut');
    const kfs = getClip()?.keyframes?.brightness ?? [];
    expect(kfs[0].easing).toBe('easeOut');
    expect(kfs[1].easing).toBe('linear');
  });
});

describe('moveKeyframes', () => {
  beforeEach(resetStore);

  it('should move keyframes at the given time across all effect keys', () => {
    setupClip();
    const { addKeyframe, moveKeyframes } = useTimelineStore.getState();
    addKeyframe('v1', 'clip-1', 'brightness', { time: 1.0, value: 1.5, easing: 'linear' });
    addKeyframe('v1', 'clip-1', 'contrast', { time: 1.0, value: 0.8, easing: 'linear' });
    moveKeyframes('v1', 'clip-1', 1.0, 3.0);
    const clip = getClip();
    expect(clip?.keyframes?.brightness?.[0].time).toBe(3.0);
    expect(clip?.keyframes?.contrast?.[0].time).toBe(3.0);
  });

  it('should re-sort keyframes after move', () => {
    setupClip();
    const { addKeyframe, moveKeyframes } = useTimelineStore.getState();
    addKeyframe('v1', 'clip-1', 'brightness', { time: 1.0, value: 1.0, easing: 'linear' });
    addKeyframe('v1', 'clip-1', 'brightness', { time: 3.0, value: 2.0, easing: 'linear' });
    moveKeyframes('v1', 'clip-1', 3.0, 0.5);
    const kfs = getClip()?.keyframes?.brightness ?? [];
    expect(kfs[0].time).toBe(0.5);
    expect(kfs[1].time).toBe(1.0);
  });

  it('should undo moveKeyframes', () => {
    setupClip();
    const { addKeyframe, moveKeyframes, undo } = useTimelineStore.getState();
    addKeyframe('v1', 'clip-1', 'brightness', { time: 1.0, value: 1.5, easing: 'linear' });
    moveKeyframes('v1', 'clip-1', 1.0, 3.0);
    expect(getClip()?.keyframes?.brightness?.[0].time).toBe(3.0);
    undo();
    expect(getClip()?.keyframes?.brightness?.[0].time).toBe(1.0);
  });
});

describe('deleteKeyframesAtTime', () => {
  beforeEach(resetStore);

  it('should delete keyframes across all effect keys at the given time', () => {
    setupClip();
    const { addKeyframe, deleteKeyframesAtTime } = useTimelineStore.getState();
    addKeyframe('v1', 'clip-1', 'brightness', { time: 1.0, value: 1.5, easing: 'linear' });
    addKeyframe('v1', 'clip-1', 'contrast', { time: 1.0, value: 0.8, easing: 'linear' });
    deleteKeyframesAtTime('v1', 'clip-1', 1.0);
    expect(getClip()?.keyframes).toBeUndefined();
  });

  it('should only delete keyframes at the specified time', () => {
    setupClip();
    const { addKeyframe, deleteKeyframesAtTime } = useTimelineStore.getState();
    addKeyframe('v1', 'clip-1', 'brightness', { time: 1.0, value: 1.5, easing: 'linear' });
    addKeyframe('v1', 'clip-1', 'brightness', { time: 2.0, value: 2.0, easing: 'linear' });
    deleteKeyframesAtTime('v1', 'clip-1', 1.0);
    const kfs = getClip()?.keyframes?.brightness ?? [];
    expect(kfs).toHaveLength(1);
    expect(kfs[0].time).toBe(2.0);
  });

  it('should undo deleteKeyframesAtTime', () => {
    setupClip();
    const { addKeyframe, deleteKeyframesAtTime, undo } = useTimelineStore.getState();
    addKeyframe('v1', 'clip-1', 'brightness', { time: 1.0, value: 1.5, easing: 'linear' });
    addKeyframe('v1', 'clip-1', 'contrast', { time: 1.0, value: 0.8, easing: 'linear' });
    deleteKeyframesAtTime('v1', 'clip-1', 1.0);
    expect(getClip()?.keyframes).toBeUndefined();
    undo();
    expect(getClip()?.keyframes?.brightness).toHaveLength(1);
    expect(getClip()?.keyframes?.contrast).toHaveLength(1);
  });
});

describe('keyframe undo/redo', () => {
  beforeEach(resetStore);

  it('should undo addKeyframe', () => {
    setupClip();
    const { addKeyframe, undo } = useTimelineStore.getState();
    addKeyframe('v1', 'clip-1', 'brightness', { time: 1.0, value: 1.5, easing: 'linear' });
    expect(getClip()?.keyframes?.brightness).toHaveLength(1);
    undo();
    expect(getClip()?.keyframes).toBeUndefined();
  });

  it('should redo addKeyframe after undo', () => {
    setupClip();
    const { addKeyframe, undo, redo } = useTimelineStore.getState();
    addKeyframe('v1', 'clip-1', 'brightness', { time: 1.0, value: 1.5, easing: 'linear' });
    undo();
    redo();
    expect(getClip()?.keyframes?.brightness).toHaveLength(1);
  });

  it('should undo removeKeyframe', () => {
    setupClip();
    const { addKeyframe, removeKeyframe, undo } = useTimelineStore.getState();
    addKeyframe('v1', 'clip-1', 'brightness', { time: 1.0, value: 1.5, easing: 'linear' });
    addKeyframe('v1', 'clip-1', 'brightness', { time: 2.0, value: 2.0, easing: 'linear' });
    removeKeyframe('v1', 'clip-1', 'brightness', 1.0);
    expect(getClip()?.keyframes?.brightness).toHaveLength(1);
    undo();
    expect(getClip()?.keyframes?.brightness).toHaveLength(2);
  });

  it('should undo updateKeyframeEasing', () => {
    setupClip();
    const { addKeyframe, updateKeyframeEasing, undo } = useTimelineStore.getState();
    addKeyframe('v1', 'clip-1', 'brightness', { time: 1.0, value: 1.5, easing: 'linear' });
    updateKeyframeEasing('v1', 'clip-1', 'brightness', 1.0, 'easeIn');
    expect(getClip()?.keyframes?.brightness?.[0].easing).toBe('easeIn');
    undo();
    expect(getClip()?.keyframes?.brightness?.[0].easing).toBe('linear');
  });
});
