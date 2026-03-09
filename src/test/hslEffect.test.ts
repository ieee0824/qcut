import { describe, it, expect, beforeEach } from 'vitest';
import { useTimelineStore, DEFAULT_EFFECTS } from '../store/timelineStore';

describe('HSL per-color saturation effects', () => {
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

  it('should have all HSL fields in DEFAULT_EFFECTS with default value 0', () => {
    expect(DEFAULT_EFFECTS.hslRedSat).toBe(0);
    expect(DEFAULT_EFFECTS.hslYellowSat).toBe(0);
    expect(DEFAULT_EFFECTS.hslGreenSat).toBe(0);
    expect(DEFAULT_EFFECTS.hslCyanSat).toBe(0);
    expect(DEFAULT_EFFECTS.hslBlueSat).toBe(0);
    expect(DEFAULT_EFFECTS.hslMagentaSat).toBe(0);
  });

  it('should store HSL saturation values in clip effects', () => {
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
      effects: { ...DEFAULT_EFFECTS, hslRedSat: 0.5, hslBlueSat: -0.3 },
    });

    const state = useTimelineStore.getState();
    const clip = state.tracks[0].clips[0];
    expect(clip.effects?.hslRedSat).toBe(0.5);
    expect(clip.effects?.hslBlueSat).toBe(-0.3);
    expect(clip.effects?.hslGreenSat).toBe(0);
  });

  it('should reset all HSL values to defaults', () => {
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
      effects: {
        ...DEFAULT_EFFECTS,
        hslRedSat: 0.8,
        hslYellowSat: -0.5,
        hslGreenSat: 0.3,
        hslCyanSat: -0.2,
        hslBlueSat: 0.6,
        hslMagentaSat: -0.4,
      },
    });

    updateClip('video-1', 'clip-1', {
      effects: { ...DEFAULT_EFFECTS },
    });

    const state = useTimelineStore.getState();
    const clip = state.tracks[0].clips[0];
    expect(clip.effects?.hslRedSat).toBe(0);
    expect(clip.effects?.hslYellowSat).toBe(0);
    expect(clip.effects?.hslGreenSat).toBe(0);
    expect(clip.effects?.hslCyanSat).toBe(0);
    expect(clip.effects?.hslBlueSat).toBe(0);
    expect(clip.effects?.hslMagentaSat).toBe(0);
  });

  it('should include HSL values in JSON serialization', () => {
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
      effects: { ...DEFAULT_EFFECTS, hslRedSat: 0.7, hslCyanSat: -0.4 },
    });

    const state = useTimelineStore.getState();
    const clip = state.tracks[0].clips[0];
    const json = JSON.stringify(clip);
    const parsed = JSON.parse(json);
    expect(parsed.effects.hslRedSat).toBe(0.7);
    expect(parsed.effects.hslCyanSat).toBe(-0.4);
  });
});
