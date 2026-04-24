import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../store/actionLogger', () => ({
  logAction: vi.fn(),
}));

import { logAction } from '../store/actionLogger';
import { useTimelineStore } from '../store/timelineStore';

function resetStore() {
  useTimelineStore.setState({
    tracks: [],
    selectedClipId: null,
    selectedTrackId: null,
    currentTime: 0,
    isPlaying: false,
    pixelsPerSecond: 50,
    _history: [[]],
    _historyIndex: 0,
    _clipboard: null,
  });
}

describe('timeline action logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it('logs when addTrack changes state', () => {
    useTimelineStore.getState().addTrack({ id: 'v1', type: 'video', name: 'V1', clips: [] });
    expect(logAction).toHaveBeenCalledWith('addTrack', 'id=v1 type=video');
  });

  it('does not log toggleMute when the target track does not exist', () => {
    useTimelineStore.getState().toggleMute('missing');
    expect(logAction).not.toHaveBeenCalled();
  });

  it('does not log deleteSelectedClip when nothing is selected', () => {
    useTimelineStore.getState().deleteSelectedClip();
    expect(logAction).not.toHaveBeenCalled();
  });

  it('does not log pasteClip when clipboard is empty', () => {
    useTimelineStore.getState().pasteClip();
    expect(logAction).not.toHaveBeenCalled();
  });

  it('does not log undo when no history entry is available', () => {
    useTimelineStore.getState().undo();
    expect(logAction).not.toHaveBeenCalled();
  });
});
