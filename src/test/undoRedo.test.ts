import { describe, it, expect, beforeEach } from 'vitest';
import { useTimelineStore } from '../store/timelineStore';

describe('undo/redo', () => {
  beforeEach(() => {
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
  });

  it('should undo addTrack', () => {
    const { addTrack, undo } = useTimelineStore.getState();

    addTrack({ id: 'v1', type: 'video', name: 'V1', clips: [] });
    expect(useTimelineStore.getState().tracks).toHaveLength(1);

    undo();
    expect(useTimelineStore.getState().tracks).toHaveLength(0);
  });

  it('should redo after undo', () => {
    const { addTrack, undo, redo } = useTimelineStore.getState();

    addTrack({ id: 'v1', type: 'video', name: 'V1', clips: [] });
    undo();
    expect(useTimelineStore.getState().tracks).toHaveLength(0);

    redo();
    expect(useTimelineStore.getState().tracks).toHaveLength(1);
  });

  it('should undo addClip', () => {
    const { addTrack, addClip, undo } = useTimelineStore.getState();

    addTrack({ id: 'v1', type: 'video', name: 'V1', clips: [] });
    addClip('v1', {
      id: 'clip-1',
      name: 'Clip 1',
      startTime: 0,
      duration: 5,
      filePath: 'test.mp4',
      sourceStartTime: 0,
      sourceEndTime: 5,
    });

    const track = useTimelineStore.getState().tracks.find(t => t.id === 'v1');
    expect(track!.clips).toHaveLength(1);

    undo();
    const trackAfterUndo = useTimelineStore.getState().tracks.find(t => t.id === 'v1');
    expect(trackAfterUndo!.clips).toHaveLength(0);
  });

  it('should undo deleteSelectedClip', () => {
    const { addTrack, addClip, setSelectedClip, deleteSelectedClip, undo } = useTimelineStore.getState();

    addTrack({ id: 'v1', type: 'video', name: 'V1', clips: [] });
    addClip('v1', {
      id: 'clip-1',
      name: 'Clip 1',
      startTime: 0,
      duration: 5,
      filePath: 'test.mp4',
      sourceStartTime: 0,
      sourceEndTime: 5,
    });
    setSelectedClip('v1', 'clip-1');
    deleteSelectedClip();

    // Track removed because empty
    expect(useTimelineStore.getState().tracks).toHaveLength(0);

    undo();
    const trackAfterUndo = useTimelineStore.getState().tracks.find(t => t.id === 'v1');
    expect(trackAfterUndo).toBeDefined();
    expect(trackAfterUndo!.clips).toHaveLength(1);
  });

  it('should not undo past initial state', () => {
    const { undo, canUndo } = useTimelineStore.getState();
    expect(canUndo()).toBe(false);
    undo();
    expect(useTimelineStore.getState().tracks).toHaveLength(0);
  });

  it('should not redo past latest state', () => {
    const { redo, canRedo } = useTimelineStore.getState();
    expect(canRedo()).toBe(false);
    redo();
    expect(useTimelineStore.getState().tracks).toHaveLength(0);
  });

  it('should discard redo history on new action after undo', () => {
    const { addTrack, undo, redo } = useTimelineStore.getState();

    addTrack({ id: 'v1', type: 'video', name: 'V1', clips: [] });
    addTrack({ id: 'v2', type: 'video', name: 'V2', clips: [] });
    undo();

    // Now add a new track instead of redo
    useTimelineStore.getState().addTrack({ id: 'v3', type: 'audio', name: 'A1', clips: [] });

    // Redo should do nothing because history was overwritten
    redo();
    const state = useTimelineStore.getState();
    expect(state.tracks).toHaveLength(2);
    expect(state.tracks[1].id).toBe('v3');
  });
});

describe('copy/paste', () => {
  beforeEach(() => {
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
  });

  it('should copy and paste a clip', () => {
    const { addTrack, addClip, setSelectedClip, copySelectedClip } = useTimelineStore.getState();

    addTrack({ id: 'v1', type: 'video', name: 'V1', clips: [] });
    addClip('v1', {
      id: 'clip-1',
      name: 'Clip 1',
      startTime: 0,
      duration: 5,
      filePath: 'test.mp4',
      sourceStartTime: 0,
      sourceEndTime: 5,
    });
    setSelectedClip('v1', 'clip-1');
    copySelectedClip();

    // Set currentTime to paste position
    useTimelineStore.getState().setCurrentTime(10);
    useTimelineStore.getState().pasteClip();

    const track = useTimelineStore.getState().tracks.find(t => t.id === 'v1');
    expect(track!.clips).toHaveLength(2);
    expect(track!.clips[1].startTime).toBe(10);
    expect(track!.clips[1].id).not.toBe('clip-1');
  });

  it('should do nothing when pasting without copy', () => {
    const { addTrack } = useTimelineStore.getState();
    addTrack({ id: 'v1', type: 'video', name: 'V1', clips: [] });
    useTimelineStore.getState().pasteClip();

    const track = useTimelineStore.getState().tracks.find(t => t.id === 'v1');
    expect(track!.clips).toHaveLength(0);
  });

  it('should not paste video clip into audio track', () => {
    const { addTrack, addClip, setSelectedClip, copySelectedClip } = useTimelineStore.getState();

    addTrack({ id: 'v1', type: 'video', name: 'V1', clips: [] });
    addTrack({ id: 'a1', type: 'audio', name: 'A1', clips: [] });
    addClip('v1', {
      id: 'clip-1',
      name: 'Clip 1',
      startTime: 0,
      duration: 5,
      filePath: 'test.mp4',
      sourceStartTime: 0,
      sourceEndTime: 5,
    });
    setSelectedClip('v1', 'clip-1');
    copySelectedClip();

    // Select audio track, then paste
    useTimelineStore.getState().setSelectedClip('a1', null);
    useTimelineStore.getState().setCurrentTime(10);
    useTimelineStore.getState().pasteClip();

    // Should paste into v1 (same type), not a1
    const videoTrack = useTimelineStore.getState().tracks.find(t => t.id === 'v1');
    const audioTrack = useTimelineStore.getState().tracks.find(t => t.id === 'a1');
    expect(videoTrack!.clips).toHaveLength(2);
    expect(audioTrack!.clips).toHaveLength(0);
  });

  it('should generate unique IDs on multiple pastes', () => {
    const { addTrack, addClip, setSelectedClip, copySelectedClip } = useTimelineStore.getState();

    addTrack({ id: 'v1', type: 'video', name: 'V1', clips: [] });
    addClip('v1', {
      id: 'clip-1',
      name: 'Clip 1',
      startTime: 0,
      duration: 5,
      filePath: 'test.mp4',
      sourceStartTime: 0,
      sourceEndTime: 5,
    });
    setSelectedClip('v1', 'clip-1');
    copySelectedClip();

    useTimelineStore.getState().setCurrentTime(10);
    useTimelineStore.getState().pasteClip();
    useTimelineStore.getState().setCurrentTime(20);
    useTimelineStore.getState().pasteClip();

    const track = useTimelineStore.getState().tracks.find(t => t.id === 'v1');
    expect(track!.clips).toHaveLength(3);
    const ids = track!.clips.map(c => c.id);
    expect(new Set(ids).size).toBe(3); // All unique
  });

  it('should fallback to same-type track when source track is deleted', () => {
    const { addTrack, addClip, setSelectedClip, copySelectedClip } = useTimelineStore.getState();

    addTrack({ id: 'v1', type: 'video', name: 'V1', clips: [] });
    addTrack({ id: 'v2', type: 'video', name: 'V2', clips: [] });
    addClip('v1', {
      id: 'clip-1',
      name: 'Clip 1',
      startTime: 0,
      duration: 5,
      filePath: 'test.mp4',
      sourceStartTime: 0,
      sourceEndTime: 5,
    });
    // v2にもクリップを追加（空トラックは削除されるため）
    addClip('v2', {
      id: 'clip-2',
      name: 'Clip 2',
      startTime: 0,
      duration: 3,
      filePath: 'test2.mp4',
      sourceStartTime: 0,
      sourceEndTime: 3,
    });
    setSelectedClip('v1', 'clip-1');
    copySelectedClip();

    // Delete v1 by removing clip (empty tracks get removed)
    useTimelineStore.getState().deleteSelectedClip();

    // Now paste — v1 is gone, should fallback to v2
    useTimelineStore.getState().setCurrentTime(5);
    useTimelineStore.getState().pasteClip();

    const v2 = useTimelineStore.getState().tracks.find(t => t.id === 'v2');
    expect(v2!.clips).toHaveLength(2);
    expect(v2!.clips[1].startTime).toBe(5);
  });
});
