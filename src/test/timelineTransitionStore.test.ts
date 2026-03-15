import { beforeEach, describe, expect, it } from 'vitest';
import { useTimelineStore, type TimelineTransition } from '../store/timelineStore';

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

function createTransition(overrides: Partial<TimelineTransition> = {}): TimelineTransition {
  return {
    id: 'transition-1',
    type: 'crossfade',
    duration: 1,
    outTrackId: 'video-1',
    outClipId: 'clip-1',
    inTrackId: 'video-1',
    inClipId: 'clip-2',
    ...overrides,
  };
}

describe('timeline transition store', () => {
  beforeEach(resetStore);

  it('should add a timeline transition', () => {
    useTimelineStore.getState().addTransition(createTransition());

    expect(useTimelineStore.getState().transitions).toHaveLength(1);
    expect(useTimelineStore.getState().transitions[0].id).toBe('transition-1');
  });

  it('should remove a timeline transition by id', () => {
    const store = useTimelineStore.getState();
    store.addTransition(createTransition());
    store.removeTransitionById('transition-1');

    expect(useTimelineStore.getState().transitions).toHaveLength(0);
  });

  it('should update type and duration', () => {
    const store = useTimelineStore.getState();
    store.addTransition(createTransition());
    store.updateTransition('transition-1', { type: 'wipe-left', duration: 2.5 });

    expect(useTimelineStore.getState().transitions[0]).toMatchObject({
      type: 'wipe-left',
      duration: 2.5,
    });
  });

  it('should find a transition by outgoing clip id', () => {
    const transition = createTransition();
    useTimelineStore.getState().addTransition(transition);

    expect(useTimelineStore.getState().findTransitionByClipId('clip-1')).toEqual(transition);
  });

  it('should find a transition by incoming clip id', () => {
    const transition = createTransition();
    useTimelineStore.getState().addTransition(transition);

    expect(useTimelineStore.getState().findTransitionByClipId('clip-2')).toEqual(transition);
  });

  it('should not add duplicate transitions for the same clip pair', () => {
    const store = useTimelineStore.getState();
    store.addTransition(createTransition({ id: 'transition-1' }));
    store.addTransition(createTransition({ id: 'transition-2' }));

    expect(useTimelineStore.getState().transitions).toHaveLength(1);
    expect(useTimelineStore.getState().transitions[0].id).toBe('transition-1');
  });

  it('should support undo and redo', () => {
    const store = useTimelineStore.getState();
    store.addTransition(createTransition());
    expect(useTimelineStore.getState().transitions).toHaveLength(1);

    store.undo();
    expect(useTimelineStore.getState().transitions).toHaveLength(0);

    store.redo();
    expect(useTimelineStore.getState().transitions).toHaveLength(1);
  });
});
