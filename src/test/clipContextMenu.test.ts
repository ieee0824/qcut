import { describe, it, expect, beforeEach } from 'vitest';
import { useTimelineStore, DEFAULT_EFFECTS } from '../store/timelineStore';

/**
 * ClipContextMenu が呼び出すストアアクションの統合テスト。
 * コンポーネントの内部ではなく、公開されたストアAPIの振る舞いを検証する。
 */
describe('ClipContextMenu store actions', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      tracks: [],
      transitions: [],
      selectedClipId: null,
      selectedTrackId: null,
      currentTime: 0,
      isPlaying: false,
      pixelsPerSecond: 50,
    });

    const { addTrack, addClip } = useTimelineStore.getState();
    addTrack({ id: 'video-1', type: 'video', name: 'Video 1', clips: [] });
    addClip('video-1', {
      id: 'clip-1',
      name: 'Clip 1',
      startTime: 0,
      duration: 5,
      filePath: '/path/to/video.mp4',
      sourceStartTime: 0,
      sourceEndTime: 5,
    });
    addClip('video-1', {
      id: 'clip-2',
      name: 'Clip 2',
      startTime: 5,
      duration: 5,
      filePath: '/path/to/video2.mp4',
      sourceStartTime: 0,
      sourceEndTime: 5,
    });
  });

  describe('削除', () => {
    it('removeClip でクリップが削除される', () => {
      const { removeClip } = useTimelineStore.getState();
      removeClip('video-1', 'clip-1');

      const track = useTimelineStore.getState().tracks.find(t => t.id === 'video-1');
      expect(track!.clips).toHaveLength(1);
      expect(track!.clips[0].id).toBe('clip-2');
    });
  });

  describe('分割', () => {
    it('splitClipAtTime でクリップが2つに分割される', () => {
      const { splitClipAtTime } = useTimelineStore.getState();
      // clip-1 (0-5秒) を 2秒地点で分割
      splitClipAtTime('video-1', 'clip-1', 2);

      const track = useTimelineStore.getState().tracks.find(t => t.id === 'video-1');
      // 分割後: clip-1-1, clip-1-2, clip-2 = 3クリップ
      expect(track!.clips).toHaveLength(3);

      const firstHalf = track!.clips.find(c => c.id === 'clip-1-1');
      const secondHalf = track!.clips.find(c => c.id === 'clip-1-2');
      expect(firstHalf).toBeDefined();
      expect(secondHalf).toBeDefined();
      expect(firstHalf!.duration).toBe(2);
      expect(secondHalf!.duration).toBe(3);
      expect(secondHalf!.startTime).toBe(2);
    });
  });

  describe('音声分離', () => {
    it('音声トラックが作成されボリューム0のクリップが残る', () => {
      const { addTrack, addClip, updateClip } = useTimelineStore.getState();
      const clip = useTimelineStore.getState().tracks
        .find(t => t.id === 'video-1')!.clips
        .find(c => c.id === 'clip-1')!;

      // ClipContextMenu.handleExtractAudio と同等の操作を再現
      const audioTrackId = 'track-audio-test';
      addTrack({ id: audioTrackId, type: 'audio', name: `${clip.name} (音声)`, clips: [] });
      addClip(audioTrackId, {
        id: 'clip-audio-test',
        name: `${clip.name} (音声)`,
        startTime: clip.startTime,
        duration: clip.duration,
        filePath: clip.filePath,
        sourceStartTime: clip.sourceStartTime,
        sourceEndTime: clip.sourceEndTime,
        color: '#6ecf6e',
      });
      updateClip('video-1', 'clip-1', {
        effects: { ...DEFAULT_EFFECTS, ...clip.effects, volume: 0 },
      });

      const state = useTimelineStore.getState();

      // 音声トラックが追加されている
      const audioTrack = state.tracks.find(t => t.id === audioTrackId);
      expect(audioTrack).toBeDefined();
      expect(audioTrack!.type).toBe('audio');
      expect(audioTrack!.clips).toHaveLength(1);

      const audioClip = audioTrack!.clips[0];
      expect(audioClip.filePath).toBe('/path/to/video.mp4');
      expect(audioClip.startTime).toBe(0);
      expect(audioClip.duration).toBe(5);

      // 元のビデオクリップがミュートされている
      const videoTrack = state.tracks.find(t => t.id === 'video-1');
      const videoClip = videoTrack!.clips.find(c => c.id === 'clip-1');
      expect(videoClip!.effects!.volume).toBe(0);
    });
  });

  describe('トランジション', () => {
    it('addTransition でトランジションが追加される', () => {
      const { addTransition } = useTimelineStore.getState();
      addTransition({
        id: 'transition-clip-1-clip-2',
        type: 'wipe-left',
        duration: 0.5,
        outTrackId: 'video-1',
        outClipId: 'clip-1',
        inTrackId: 'video-1',
        inClipId: 'clip-2',
      });

      expect(useTimelineStore.getState().transitions[0]).toMatchObject({ type: 'wipe-left', duration: 0.5 });
    });

    it('removeTransitionById でトランジションが削除される', () => {
      const { addTransition, removeTransitionById } = useTimelineStore.getState();
      addTransition({
        id: 'transition-clip-1-clip-2',
        type: 'dissolve',
        duration: 1.0,
        outTrackId: 'video-1',
        outClipId: 'clip-1',
        inTrackId: 'video-1',
        inClipId: 'clip-2',
      });
      removeTransitionById('transition-clip-1-clip-2');

      expect(useTimelineStore.getState().transitions).toEqual([]);
    });
  });

  describe('トラック間移動', () => {
    it('moveClipToTrack でクリップが別トラックに移動する', () => {
      const { addTrack, moveClipToTrack } = useTimelineStore.getState();
      addTrack({ id: 'video-2', type: 'video', name: 'Video 2', clips: [] });

      moveClipToTrack('video-1', 'clip-1', 'video-2');

      const state = useTimelineStore.getState();
      const track1 = state.tracks.find(t => t.id === 'video-1');
      const track2 = state.tracks.find(t => t.id === 'video-2');

      expect(track1!.clips.find(c => c.id === 'clip-1')).toBeUndefined();
      expect(track2!.clips.find(c => c.id === 'clip-1')).toBeDefined();
    });
  });
});
