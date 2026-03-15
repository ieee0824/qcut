import { describe, it, expect, beforeEach } from 'vitest';
import { useTimelineStore } from '../store/timelineStore';
import type { Clip, Track, ToneCurveKeyframe } from '../store/timelineStore';
import { DEFAULT_EFFECTS } from '../store/timelineStore';

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

function addVideoTrackWithClip(trackId = 'v1', clipId = 'clip-1') {
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

function getTrack(trackId: string): Track | undefined {
  return useTimelineStore.getState().tracks.find(t => t.id === trackId);
}

function getClip(trackId: string, clipId: string): Clip | undefined {
  return getTrack(trackId)?.clips.find(c => c.id === clipId);
}

describe('playback state', () => {
  beforeEach(resetStore);

  it('setPixelsPerSecond should update value', () => {
    useTimelineStore.getState().setPixelsPerSecond(100);
    expect(useTimelineStore.getState().pixelsPerSecond).toBe(100);
  });

  it('setCurrentTime should update value', () => {
    useTimelineStore.getState().setCurrentTime(42);
    expect(useTimelineStore.getState().currentTime).toBe(42);
  });

  it('setIsPlaying should update value', () => {
    useTimelineStore.getState().setIsPlaying(true);
    expect(useTimelineStore.getState().isPlaying).toBe(true);
  });
});

describe('setSelectedClip', () => {
  beforeEach(resetStore);

  it('should set selected clip and track', () => {
    useTimelineStore.getState().setSelectedClip('v1', 'clip-1');
    const state = useTimelineStore.getState();
    expect(state.selectedTrackId).toBe('v1');
    expect(state.selectedClipId).toBe('clip-1');
  });

  it('should clear selection with null', () => {
    useTimelineStore.getState().setSelectedClip('v1', 'clip-1');
    useTimelineStore.getState().setSelectedClip(null, null);
    const state = useTimelineStore.getState();
    expect(state.selectedTrackId).toBeNull();
    expect(state.selectedClipId).toBeNull();
  });
});

describe('addTrack', () => {
  beforeEach(resetStore);

  it('should set default volume, mute, solo', () => {
    useTimelineStore.getState().addTrack({
      id: 'v1', type: 'video', name: 'V1', clips: [],
    });
    const track = getTrack('v1')!;
    expect(track.volume).toBe(1.0);
    expect(track.mute).toBe(false);
    expect(track.solo).toBe(false);
  });

  it('should respect provided volume, mute, solo', () => {
    useTimelineStore.getState().addTrack({
      id: 'v1', type: 'video', name: 'V1', clips: [],
      volume: 0.5, mute: true, solo: true,
    });
    const track = getTrack('v1')!;
    expect(track.volume).toBe(0.5);
    expect(track.mute).toBe(true);
    expect(track.solo).toBe(true);
  });

  it('should record history', () => {
    useTimelineStore.getState().addTrack({
      id: 'v1', type: 'video', name: 'V1', clips: [],
    });
    expect(useTimelineStore.getState().canUndo()).toBe(true);
  });
});

describe('removeTrack', () => {
  beforeEach(resetStore);

  it('should remove a track by id', () => {
    useTimelineStore.getState().addTrack({ id: 'v1', type: 'video', name: 'V1', clips: [] });
    useTimelineStore.getState().addTrack({ id: 'v2', type: 'video', name: 'V2', clips: [] });
    useTimelineStore.getState().removeTrack('v1');
    expect(useTimelineStore.getState().tracks).toHaveLength(1);
    expect(useTimelineStore.getState().tracks[0].id).toBe('v2');
  });

  it('should be undoable', () => {
    useTimelineStore.getState().addTrack({ id: 'v1', type: 'video', name: 'V1', clips: [] });
    useTimelineStore.getState().removeTrack('v1');
    expect(useTimelineStore.getState().tracks).toHaveLength(0);
    useTimelineStore.getState().undo();
    expect(useTimelineStore.getState().tracks).toHaveLength(1);
  });
});

describe('updateTrackVolume', () => {
  beforeEach(resetStore);

  it('should update volume for a track', () => {
    useTimelineStore.getState().addTrack({ id: 'v1', type: 'video', name: 'V1', clips: [] });
    useTimelineStore.getState().updateTrackVolume('v1', 0.7);
    expect(getTrack('v1')!.volume).toBe(0.7);
  });

  it('should be undoable', () => {
    useTimelineStore.getState().addTrack({ id: 'v1', type: 'video', name: 'V1', clips: [] });
    useTimelineStore.getState().updateTrackVolume('v1', 0.3);
    useTimelineStore.getState().undo();
    expect(getTrack('v1')!.volume).toBe(1.0);
  });
});

describe('toggleMute', () => {
  beforeEach(resetStore);

  it('should toggle mute on and off', () => {
    useTimelineStore.getState().addTrack({ id: 'v1', type: 'video', name: 'V1', clips: [] });
    useTimelineStore.getState().toggleMute('v1');
    expect(getTrack('v1')!.mute).toBe(true);
    useTimelineStore.getState().toggleMute('v1');
    expect(getTrack('v1')!.mute).toBe(false);
  });

  it('should do nothing for non-existent track', () => {
    useTimelineStore.getState().addTrack({ id: 'v1', type: 'video', name: 'V1', clips: [] });
    useTimelineStore.getState().toggleMute('nonexistent');
    expect(getTrack('v1')!.mute).toBe(false);
  });
});

describe('toggleSolo', () => {
  beforeEach(resetStore);

  it('should toggle solo on and off', () => {
    useTimelineStore.getState().addTrack({ id: 'v1', type: 'video', name: 'V1', clips: [] });
    useTimelineStore.getState().toggleSolo('v1');
    expect(getTrack('v1')!.solo).toBe(true);
    useTimelineStore.getState().toggleSolo('v1');
    expect(getTrack('v1')!.solo).toBe(false);
  });

  it('should do nothing for non-existent track', () => {
    useTimelineStore.getState().addTrack({ id: 'v1', type: 'video', name: 'V1', clips: [] });
    useTimelineStore.getState().toggleSolo('nonexistent');
    expect(getTrack('v1')!.solo).toBe(false);
  });
});

describe('updateClip', () => {
  beforeEach(() => {
    resetStore();
    addVideoTrackWithClip();
  });

  it('should update clip properties', () => {
    useTimelineStore.getState().updateClip('v1', 'clip-1', { duration: 20 });
    expect(getClip('v1', 'clip-1')!.duration).toBe(20);
  });

  it('should record history', () => {
    const indexBefore = useTimelineStore.getState()._historyIndex;
    useTimelineStore.getState().updateClip('v1', 'clip-1', { duration: 20 });
    expect(useTimelineStore.getState()._historyIndex).toBe(indexBefore + 1);
  });

  it('should not affect other clips', () => {
    useTimelineStore.getState().addClip('v1', {
      id: 'clip-2', name: 'Clip 2', startTime: 10, duration: 5,
      filePath: 'test2.mp4', sourceStartTime: 0, sourceEndTime: 5,
    });
    useTimelineStore.getState().updateClip('v1', 'clip-1', { duration: 20 });
    expect(getClip('v1', 'clip-2')!.duration).toBe(5);
  });
});

describe('updateClipSilent', () => {
  beforeEach(() => {
    resetStore();
    addVideoTrackWithClip();
  });

  it('should update clip without recording history', () => {
    const indexBefore = useTimelineStore.getState()._historyIndex;
    useTimelineStore.getState().updateClipSilent('v1', 'clip-1', { duration: 20 });
    expect(getClip('v1', 'clip-1')!.duration).toBe(20);
    expect(useTimelineStore.getState()._historyIndex).toBe(indexBefore);
  });
});

describe('commitHistory', () => {
  beforeEach(() => {
    resetStore();
    addVideoTrackWithClip();
  });

  it('should snapshot current tracks into history', () => {
    const indexBefore = useTimelineStore.getState()._historyIndex;
    useTimelineStore.getState().updateClipSilent('v1', 'clip-1', { duration: 20 });
    useTimelineStore.getState().commitHistory();
    expect(useTimelineStore.getState()._historyIndex).toBe(indexBefore + 1);
  });

  it('should allow undo after commitHistory', () => {
    useTimelineStore.getState().updateClipSilent('v1', 'clip-1', { duration: 20 });
    useTimelineStore.getState().commitHistory();
    useTimelineStore.getState().undo();
    expect(getClip('v1', 'clip-1')!.duration).toBe(10);
  });
});

describe('splitClipAtTime', () => {
  beforeEach(() => {
    resetStore();
    addVideoTrackWithClip();
  });

  it('should split a clip into two at the given time', () => {
    useTimelineStore.getState().splitClipAtTime('v1', 'clip-1', 4);
    const track = getTrack('v1')!;
    expect(track.clips).toHaveLength(2);

    const first = track.clips[0];
    const second = track.clips[1];
    expect(first.id).toBe('clip-1-1');
    expect(first.duration).toBe(4);
    expect(first.sourceEndTime).toBe(4);

    expect(second.id).toBe('clip-1-2');
    expect(second.startTime).toBe(4);
    expect(second.duration).toBe(6);
    expect(second.sourceStartTime).toBe(4);
  });

  it('should not split at start boundary', () => {
    useTimelineStore.getState().splitClipAtTime('v1', 'clip-1', 0);
    expect(getTrack('v1')!.clips).toHaveLength(1);
  });

  it('should not split at end boundary', () => {
    useTimelineStore.getState().splitClipAtTime('v1', 'clip-1', 10);
    expect(getTrack('v1')!.clips).toHaveLength(1);
  });

  it('should not split for non-existent track', () => {
    useTimelineStore.getState().splitClipAtTime('nonexistent', 'clip-1', 5);
    expect(getTrack('v1')!.clips).toHaveLength(1);
  });

  it('should not split for non-existent clip', () => {
    useTimelineStore.getState().splitClipAtTime('v1', 'nonexistent', 5);
    expect(getTrack('v1')!.clips).toHaveLength(1);
  });

  it('should be undoable', () => {
    useTimelineStore.getState().splitClipAtTime('v1', 'clip-1', 5);
    expect(getTrack('v1')!.clips).toHaveLength(2);
    useTimelineStore.getState().undo();
    expect(getTrack('v1')!.clips).toHaveLength(1);
    expect(getTrack('v1')!.clips[0].id).toBe('clip-1');
  });
});

describe('moveClipToTrack', () => {
  beforeEach(() => {
    resetStore();
    addVideoTrackWithClip('v1', 'clip-1');
    useTimelineStore.getState().addTrack({ id: 'v2', type: 'video', name: 'V2', clips: [] });
    useTimelineStore.getState().addClip('v2', {
      id: 'clip-2', name: 'Clip 2', startTime: 0, duration: 5,
      filePath: 'test2.mp4', sourceStartTime: 0, sourceEndTime: 5,
    });
  });

  it('should move clip from one track to another', () => {
    useTimelineStore.getState().moveClipToTrack('v1', 'clip-1', 'v2');
    expect(getTrack('v1')!.clips).toHaveLength(0);
    expect(getTrack('v2')!.clips).toHaveLength(2);
    expect(getTrack('v2')!.clips[1].id).toBe('clip-1');
  });

  it('should update selectedTrackId to destination', () => {
    useTimelineStore.getState().moveClipToTrack('v1', 'clip-1', 'v2');
    expect(useTimelineStore.getState().selectedTrackId).toBe('v2');
  });

  it('should do nothing when from and to are the same', () => {
    useTimelineStore.getState().moveClipToTrack('v1', 'clip-1', 'v1');
    expect(getTrack('v1')!.clips).toHaveLength(1);
  });

  it('should do nothing for non-existent source track', () => {
    useTimelineStore.getState().moveClipToTrack('nonexistent', 'clip-1', 'v2');
    expect(getTrack('v1')!.clips).toHaveLength(1);
  });

  it('should do nothing for non-existent clip', () => {
    useTimelineStore.getState().moveClipToTrack('v1', 'nonexistent', 'v2');
    expect(getTrack('v1')!.clips).toHaveLength(1);
    expect(getTrack('v2')!.clips).toHaveLength(1);
  });

  it('should be undoable', () => {
    useTimelineStore.getState().moveClipToTrack('v1', 'clip-1', 'v2');
    useTimelineStore.getState().undo();
    expect(getTrack('v1')!.clips).toHaveLength(1);
    expect(getTrack('v2')!.clips).toHaveLength(1);
  });
});

describe('removeClip selection clearing', () => {
  beforeEach(() => {
    resetStore();
    addVideoTrackWithClip();
  });

  it('should clear selection when removing the selected clip', () => {
    useTimelineStore.getState().setSelectedClip('v1', 'clip-1');
    useTimelineStore.getState().removeClip('v1', 'clip-1');
    const state = useTimelineStore.getState();
    expect(state.selectedClipId).toBeNull();
    expect(state.selectedTrackId).toBeNull();
  });

  it('should keep selection when removing a different clip', () => {
    useTimelineStore.getState().addClip('v1', {
      id: 'clip-2', name: 'Clip 2', startTime: 10, duration: 5,
      filePath: 'test2.mp4', sourceStartTime: 0, sourceEndTime: 5,
    });
    useTimelineStore.getState().setSelectedClip('v1', 'clip-1');
    useTimelineStore.getState().removeClip('v1', 'clip-2');
    const state = useTimelineStore.getState();
    expect(state.selectedClipId).toBe('clip-1');
    expect(state.selectedTrackId).toBe('v1');
  });
});

describe('deleteSelectedClip', () => {
  beforeEach(() => {
    resetStore();
    addVideoTrackWithClip();
  });

  it('should do nothing when nothing is selected', () => {
    useTimelineStore.getState().deleteSelectedClip();
    expect(getTrack('v1')!.clips).toHaveLength(1);
  });

  it('should remove selected clip and clear selection', () => {
    useTimelineStore.getState().setSelectedClip('v1', 'clip-1');
    useTimelineStore.getState().deleteSelectedClip();
    const state = useTimelineStore.getState();
    expect(state.selectedClipId).toBeNull();
    expect(state.selectedTrackId).toBeNull();
    // Track removed because empty
    expect(state.tracks.find(t => t.id === 'v1')).toBeUndefined();
  });

  it('should remove empty track after deleting last clip', () => {
    useTimelineStore.getState().setSelectedClip('v1', 'clip-1');
    useTimelineStore.getState().deleteSelectedClip();
    expect(useTimelineStore.getState().tracks).toHaveLength(0);
  });

  it('should keep track with remaining clips', () => {
    useTimelineStore.getState().addClip('v1', {
      id: 'clip-2', name: 'Clip 2', startTime: 10, duration: 5,
      filePath: 'test2.mp4', sourceStartTime: 0, sourceEndTime: 5,
    });
    useTimelineStore.getState().setSelectedClip('v1', 'clip-1');
    useTimelineStore.getState().deleteSelectedClip();
    expect(getTrack('v1')!.clips).toHaveLength(1);
    expect(getTrack('v1')!.clips[0].id).toBe('clip-2');
  });
});

describe('undo/redo clears selection', () => {
  beforeEach(resetStore);

  it('should clear selection on undo', () => {
    addVideoTrackWithClip();
    useTimelineStore.getState().setSelectedClip('v1', 'clip-1');
    useTimelineStore.getState().undo();
    const state = useTimelineStore.getState();
    expect(state.selectedClipId).toBeNull();
    expect(state.selectedTrackId).toBeNull();
  });

  it('should clear selection on redo', () => {
    addVideoTrackWithClip();
    useTimelineStore.getState().setSelectedClip('v1', 'clip-1');
    useTimelineStore.getState().undo();
    useTimelineStore.getState().setSelectedClip('v1', 'clip-1');
    useTimelineStore.getState().redo();
    const state = useTimelineStore.getState();
    expect(state.selectedClipId).toBeNull();
    expect(state.selectedTrackId).toBeNull();
  });
});

describe('toneCurveKeyframes store operations', () => {
  beforeEach(resetStore);

  const makeTcKf = (time: number): ToneCurveKeyframe => ({
    time,
    toneCurves: {
      rgb: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      r: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      g: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      b: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    },
    easing: 'linear',
  });

  it('addToneCurveKeyframe should add a keyframe to the clip', () => {
    addVideoTrackWithClip();
    useTimelineStore.getState().addToneCurveKeyframe('v1', 'clip-1', makeTcKf(0));
    useTimelineStore.getState().addToneCurveKeyframe('v1', 'clip-1', makeTcKf(4));
    const clip = getClip('v1', 'clip-1');
    expect(clip?.toneCurveKeyframes).toHaveLength(2);
    expect(clip?.toneCurveKeyframes![0].time).toBe(0);
    expect(clip?.toneCurveKeyframes![1].time).toBe(4);
  });

  it('addToneCurveKeyframe should overwrite keyframe at same time', () => {
    addVideoTrackWithClip();
    const kf1 = makeTcKf(2);
    const kf2: ToneCurveKeyframe = {
      ...makeTcKf(2),
      toneCurves: {
        rgb: [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }],
        r: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
        g: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
        b: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      },
    };
    useTimelineStore.getState().addToneCurveKeyframe('v1', 'clip-1', kf1);
    useTimelineStore.getState().addToneCurveKeyframe('v1', 'clip-1', kf2);
    const clip = getClip('v1', 'clip-1');
    expect(clip?.toneCurveKeyframes).toHaveLength(1);
    expect(clip?.toneCurveKeyframes![0].toneCurves.rgb[0].y).toBe(0.5);
  });

  it('removeToneCurveKeyframe should remove the keyframe at given time', () => {
    addVideoTrackWithClip();
    useTimelineStore.getState().addToneCurveKeyframe('v1', 'clip-1', makeTcKf(0));
    useTimelineStore.getState().addToneCurveKeyframe('v1', 'clip-1', makeTcKf(4));
    useTimelineStore.getState().removeToneCurveKeyframe('v1', 'clip-1', 0);
    const clip = getClip('v1', 'clip-1');
    expect(clip?.toneCurveKeyframes).toHaveLength(1);
    expect(clip?.toneCurveKeyframes![0].time).toBe(4);
  });

  it('removeToneCurveKeyframe should set undefined when all keyframes removed', () => {
    addVideoTrackWithClip();
    useTimelineStore.getState().addToneCurveKeyframe('v1', 'clip-1', makeTcKf(2));
    useTimelineStore.getState().removeToneCurveKeyframe('v1', 'clip-1', 2);
    const clip = getClip('v1', 'clip-1');
    expect(clip?.toneCurveKeyframes).toBeUndefined();
  });

  it('updateToneCurveKeyframeEasing should update easing type', () => {
    addVideoTrackWithClip();
    useTimelineStore.getState().addToneCurveKeyframe('v1', 'clip-1', makeTcKf(1));
    useTimelineStore.getState().updateToneCurveKeyframeEasing('v1', 'clip-1', 1, 'easeIn');
    const clip = getClip('v1', 'clip-1');
    expect(clip?.toneCurveKeyframes![0].easing).toBe('easeIn');
  });

  // Bug fix #3: リセットで toneCurveKeyframes が消えることを検証
  it('updateClip with toneCurveKeyframes: undefined should clear keyframes (reset scenario)', () => {
    addVideoTrackWithClip();
    useTimelineStore.getState().addToneCurveKeyframe('v1', 'clip-1', makeTcKf(0));
    useTimelineStore.getState().addToneCurveKeyframe('v1', 'clip-1', makeTcKf(4));
    // リセット相当の操作
    useTimelineStore.getState().updateClip('v1', 'clip-1', {
      effects: { ...DEFAULT_EFFECTS },
      keyframes: undefined,
      toneCurves: undefined,
      toneCurveKeyframes: undefined,
    });
    const clip = getClip('v1', 'clip-1');
    expect(clip?.toneCurveKeyframes).toBeUndefined();
    expect(clip?.toneCurves).toBeUndefined();
    expect(clip?.keyframes).toBeUndefined();
  });
});
