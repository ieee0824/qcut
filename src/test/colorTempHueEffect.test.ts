import { describe, it, expect, beforeEach } from 'vitest';
import { useTimelineStore, DEFAULT_EFFECTS } from '../store/timelineStore';

describe('color temperature and hue effects', () => {
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

  it('should have colorTemperature and hue in DEFAULT_EFFECTS with default value 0', () => {
    expect(DEFAULT_EFFECTS.colorTemperature).toBe(0);
    expect(DEFAULT_EFFECTS.hue).toBe(0);
  });

  it('should store colorTemperature in clip effects', () => {
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
      effects: { ...DEFAULT_EFFECTS, colorTemperature: 0.5 },
    });

    const state = useTimelineStore.getState();
    const clip = state.tracks[0].clips[0];
    expect(clip.effects?.colorTemperature).toBe(0.5);
  });

  it('should store hue in clip effects', () => {
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
      effects: { ...DEFAULT_EFFECTS, hue: 90 },
    });

    const state = useTimelineStore.getState();
    const clip = state.tracks[0].clips[0];
    expect(clip.effects?.hue).toBe(90);
  });

  it('should reset colorTemperature and hue to defaults', () => {
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
      effects: { ...DEFAULT_EFFECTS, colorTemperature: -0.8, hue: -120 },
    });

    updateClip('video-1', 'clip-1', {
      effects: { ...DEFAULT_EFFECTS },
    });

    const state = useTimelineStore.getState();
    const clip = state.tracks[0].clips[0];
    expect(clip.effects?.colorTemperature).toBe(0);
    expect(clip.effects?.hue).toBe(0);
  });

  it('should include colorTemperature and hue in JSON serialization', () => {
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
      effects: { ...DEFAULT_EFFECTS, colorTemperature: 0.7, hue: 45 },
    });

    const state = useTimelineStore.getState();
    const clip = state.tracks[0].clips[0];
    const json = JSON.stringify(clip);
    const parsed = JSON.parse(json);
    expect(parsed.effects.colorTemperature).toBe(0.7);
    expect(parsed.effects.hue).toBe(45);
  });
});
