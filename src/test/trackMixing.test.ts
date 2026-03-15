import { describe, it, expect, beforeEach } from 'vitest';
import { useTimelineStore } from '../store/timelineStore';

describe('Track Mixing (volume / mute / solo)', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      tracks: [],
      transitions: [],
      selectedClipId: null,
      selectedTrackId: null,
      _history: [{ tracks: [], transitions: [] }],
      _historyIndex: 0,
    });
  });

  it('addTrack にデフォルトの volume/mute/solo が設定される', () => {
    const { addTrack } = useTimelineStore.getState();
    addTrack({ id: 'v1', type: 'video', name: 'V1', clips: [] });
    const track = useTimelineStore.getState().tracks[0];
    expect(track.volume).toBe(1.0);
    expect(track.mute).toBe(false);
    expect(track.solo).toBe(false);
  });

  it('addTrack にカスタム volume/mute/solo を渡せる', () => {
    const { addTrack } = useTimelineStore.getState();
    addTrack({ id: 'v1', type: 'video', name: 'V1', clips: [], volume: 0.5, mute: true, solo: true });
    const track = useTimelineStore.getState().tracks[0];
    expect(track.volume).toBe(0.5);
    expect(track.mute).toBe(true);
    expect(track.solo).toBe(true);
  });

  it('updateTrackVolume でトラック音量を変更できる', () => {
    const { addTrack } = useTimelineStore.getState();
    addTrack({ id: 'a1', type: 'audio', name: 'A1', clips: [] });

    useTimelineStore.getState().updateTrackVolume('a1', 0.75);
    expect(useTimelineStore.getState().tracks[0].volume).toBe(0.75);
  });

  it('toggleMute でミュートを切り替えられる', () => {
    const { addTrack } = useTimelineStore.getState();
    addTrack({ id: 'a1', type: 'audio', name: 'A1', clips: [] });

    useTimelineStore.getState().toggleMute('a1');
    expect(useTimelineStore.getState().tracks[0].mute).toBe(true);

    useTimelineStore.getState().toggleMute('a1');
    expect(useTimelineStore.getState().tracks[0].mute).toBe(false);
  });

  it('toggleSolo でソロを切り替えられる', () => {
    const { addTrack } = useTimelineStore.getState();
    addTrack({ id: 'a1', type: 'audio', name: 'A1', clips: [] });

    useTimelineStore.getState().toggleSolo('a1');
    expect(useTimelineStore.getState().tracks[0].solo).toBe(true);

    useTimelineStore.getState().toggleSolo('a1');
    expect(useTimelineStore.getState().tracks[0].solo).toBe(false);
  });

  it('updateTrackVolume / toggleMute / toggleSolo は undo/redo できる', () => {
    const { addTrack } = useTimelineStore.getState();
    addTrack({ id: 'a1', type: 'audio', name: 'A1', clips: [] });

    useTimelineStore.getState().updateTrackVolume('a1', 0.3);
    expect(useTimelineStore.getState().tracks[0].volume).toBe(0.3);

    useTimelineStore.getState().undo();
    expect(useTimelineStore.getState().tracks[0].volume).toBe(1.0);

    useTimelineStore.getState().redo();
    expect(useTimelineStore.getState().tracks[0].volume).toBe(0.3);
  });

  it('存在しないトラックIDでの操作は何もしない', () => {
    const { addTrack } = useTimelineStore.getState();
    addTrack({ id: 'a1', type: 'audio', name: 'A1', clips: [] });

    useTimelineStore.getState().toggleMute('nonexistent');
    expect(useTimelineStore.getState().tracks[0].mute).toBe(false);

    useTimelineStore.getState().toggleSolo('nonexistent');
    expect(useTimelineStore.getState().tracks[0].solo).toBe(false);
  });

  it('複数トラックで独立して mute/solo を操作できる', () => {
    const { addTrack } = useTimelineStore.getState();
    addTrack({ id: 'v1', type: 'video', name: 'V1', clips: [] });
    addTrack({ id: 'a1', type: 'audio', name: 'A1', clips: [] });
    addTrack({ id: 'a2', type: 'audio', name: 'A2', clips: [] });

    useTimelineStore.getState().toggleMute('a1');
    useTimelineStore.getState().toggleSolo('a2');

    const tracks = useTimelineStore.getState().tracks;
    expect(tracks[0].mute).toBe(false); // v1
    expect(tracks[1].mute).toBe(true);  // a1 muted
    expect(tracks[1].solo).toBe(false);
    expect(tracks[2].mute).toBe(false); // a2
    expect(tracks[2].solo).toBe(true);  // a2 solo
  });
});
