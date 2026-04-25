import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTimelineStore } from '../store/timelineStore';
import { DEFAULT_TEXT_PROPERTIES } from '../store/timelineStore';
import { generateId } from '../utils/idGenerator';

describe('handleAddTextTrack 相当のフロー', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      tracks: [],
      currentTime: 5,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('テキストトラックとクリップが generateId で追加される', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const { addTrack, addClip, tracks } = useTimelineStore.getState();
    const trackId = generateId('track-text');
    addTrack({ id: trackId, type: 'text', name: `Text ${tracks.filter((t) => t.type === 'text').length + 1}`, clips: [] });
    addClip(trackId, {
      id: generateId('text'),
      name: 'テキスト',
      startTime: useTimelineStore.getState().currentTime,
      duration: 3,
      color: '#e6a817',
      filePath: '',
      sourceStartTime: 0,
      sourceEndTime: 0,
      textProperties: { ...DEFAULT_TEXT_PROPERTIES },
    });

    const state = useTimelineStore.getState();
    const textTrack = state.tracks.find(t => t.type === 'text');
    expect(textTrack).toBeDefined();
    expect(textTrack!.id).toMatch(/^track-text-/);
    expect(textTrack!.name).toBe('Text 1');
    expect(textTrack!.clips).toHaveLength(1);

    const clip = textTrack!.clips[0];
    expect(clip.id).toMatch(/^text-/);
    expect(clip.startTime).toBe(5);
    expect(clip.duration).toBe(3);
    expect(clip.textProperties).toEqual(DEFAULT_TEXT_PROPERTIES);
  });

  it('複数回追加するとトラック名が連番になる', () => {
    const { addTrack, addClip } = useTimelineStore.getState();

    // 1つ目
    const trackId1 = generateId('track-text');
    addTrack({ id: trackId1, type: 'text', name: 'Text 1', clips: [] });
    addClip(trackId1, {
      id: generateId('text'),
      name: 'テキスト',
      startTime: 0,
      duration: 3,
      color: '#e6a817',
      filePath: '',
      sourceStartTime: 0,
      sourceEndTime: 0,
      textProperties: { ...DEFAULT_TEXT_PROPERTIES },
    });

    // 2つ目
    const tracks = useTimelineStore.getState().tracks;
    const trackId2 = generateId('track-text');
    addTrack({ id: trackId2, type: 'text', name: `Text ${tracks.filter(t => t.type === 'text').length + 1}`, clips: [] });

    const state = useTimelineStore.getState();
    const textTracks = state.tracks.filter(t => t.type === 'text');
    expect(textTracks).toHaveLength(2);
    expect(textTracks[1].name).toBe('Text 2');
  });
});
