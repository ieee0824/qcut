import { describe, it, expect, beforeEach } from 'vitest';
import { resolveTargetTrackId, buildPastedClip } from '../store/timeline/clipboardSlice';
import { useTimelineStore } from '../store/timelineStore';
import type { Track, Clip } from '../store/timeline/types';
import { DEFAULT_EFFECTS } from '../store/timeline/types';

function makeTrack(id: string, type: Track['type'], clips: Clip[] = []): Track {
  return { id, type, name: `Track ${id}`, clips, volume: 1.0, mute: false, solo: false };
}

function makeClip(id: string, overrides?: Partial<Clip>): Clip {
  return {
    id,
    name: 'Test Clip',
    startTime: 0,
    duration: 5,
    color: '#ff0000',
    filePath: '/test.mp4',
    sourceStartTime: 0,
    sourceEndTime: 5,
    effects: { ...DEFAULT_EFFECTS },
    ...overrides,
  };
}

describe('resolveTargetTrackId', () => {
  const videoTrack = makeTrack('v1', 'video');
  const audioTrack = makeTrack('a1', 'audio');
  const tracks = [videoTrack, audioTrack];

  it('選択中のトラックがコピー元と同じタイプなら選択中のトラックを返す', () => {
    const result = resolveTargetTrackId(tracks, 'v1', 'v1', 'video');
    expect(result).toBe('v1');
  });

  it('選択中のトラックがコピー元と異なるタイプならコピー元トラックにフォールバック', () => {
    const result = resolveTargetTrackId(tracks, 'a1', 'v1', 'video');
    expect(result).toBe('v1');
  });

  it('選択中トラックがなければコピー元トラックを使う', () => {
    const result = resolveTargetTrackId(tracks, null, 'v1', 'video');
    expect(result).toBe('v1');
  });

  it('コピー元トラックが削除されていたら同タイプの最初のトラックにフォールバック', () => {
    const result = resolveTargetTrackId(tracks, null, 'deleted-track', 'video');
    expect(result).toBe('v1');
  });

  it('同タイプのトラックが存在しなければ null を返す', () => {
    const result = resolveTargetTrackId(tracks, null, 'deleted-track', 'text');
    expect(result).toBeNull();
  });

  it('空のトラック配列では null を返す', () => {
    const result = resolveTargetTrackId([], null, 'v1', 'video');
    expect(result).toBeNull();
  });

  it('同タイプのトラックが複数ある場合は最初のトラックにフォールバックする', () => {
    const multiTracks = [
      makeTrack('v1', 'video'),
      makeTrack('v2', 'video'),
      makeTrack('v3', 'video'),
    ];
    const result = resolveTargetTrackId(multiTracks, null, 'deleted-track', 'video');
    expect(result).toBe('v1');
  });

  it('選択トラックがタイプ不一致かつソースも削除済みの3段階フォールバック', () => {
    const result = resolveTargetTrackId(tracks, 'a1', 'deleted-track', 'video');
    expect(result).toBe('v1');
  });
});

describe('buildPastedClip', () => {
  const sourceClip = makeClip('original-clip');

  it('固定IDジェネレータを渡すと決定的なIDを返す', () => {
    const result = buildPastedClip(sourceClip, 10, () => 'fixed-id');
    expect(result.id).toBe('fixed-id');
    expect(result.startTime).toBe(10);
  });

  it('ソースクリップのプロパティを引き継ぐ', () => {
    const result = buildPastedClip(sourceClip, 10, () => 'fixed-id');
    expect(result.name).toBe('Test Clip');
    expect(result.duration).toBe(5);
    expect(result.filePath).toBe('/test.mp4');
  });

  it('ソースクリップをディープコピーする（参照が共有されない）', () => {
    const result = buildPastedClip(sourceClip, 10, () => 'fixed-id');
    expect(result).not.toBe(sourceClip);
    expect(result.effects).not.toBe(sourceClip.effects);
  });

  it('IDジェネレータを省略するとデフォルトのIDが生成される', () => {
    const result = buildPastedClip(sourceClip, 10);
    expect(result.id).toMatch(/^clip-/);
    expect(result.id).not.toBe('original-clip');
  });

  it('同じ引数で同じ結果を返す（参照透過性）', () => {
    const gen = () => 'deterministic-id';
    const result1 = buildPastedClip(sourceClip, 10, gen);
    const result2 = buildPastedClip(sourceClip, 10, gen);
    expect(result1).toEqual(result2);
  });
});

describe('pasteClip インテグレーション', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      tracks: [
        makeTrack('v1', 'video', [makeClip('clip-1', { name: 'Video Clip' })]),
        makeTrack('a1', 'audio'),
      ],
      selectedClipId: 'clip-1',
      selectedTrackId: 'v1',
      currentTime: 10,
      isPlaying: false,
      _clipboard: null,
    });
  });

  it('copy → paste でクリップが複製される', () => {
    const store = useTimelineStore.getState();
    store.copySelectedClip();

    // currentTime を変更してからペースト
    useTimelineStore.setState({ currentTime: 20 });
    useTimelineStore.getState().pasteClip();

    const state = useTimelineStore.getState();
    const videoTrack = state.tracks.find(t => t.id === 'v1')!;
    expect(videoTrack.clips).toHaveLength(2);

    const pastedClip = videoTrack.clips[1];
    expect(pastedClip.name).toBe('Video Clip');
    expect(pastedClip.startTime).toBe(20);
    expect(pastedClip.id).not.toBe('clip-1');
  });

  it('clipboard が空の場合 pasteClip は何も変更しない', () => {
    const tracksBefore = useTimelineStore.getState().tracks;
    useTimelineStore.getState().pasteClip();
    const tracksAfter = useTimelineStore.getState().tracks;
    expect(tracksAfter).toBe(tracksBefore);
  });

  it('コピー元トラックが削除されても同タイプのトラックにペーストできる', () => {
    useTimelineStore.getState().copySelectedClip();

    // コピー元トラックを削除して、新しいvideoトラックを追加
    useTimelineStore.setState({
      tracks: [
        makeTrack('v2', 'video'),
        makeTrack('a1', 'audio'),
      ],
      selectedTrackId: null,
      currentTime: 5,
    });

    useTimelineStore.getState().pasteClip();

    const state = useTimelineStore.getState();
    const v2Track = state.tracks.find(t => t.id === 'v2')!;
    expect(v2Track.clips).toHaveLength(1);
    expect(v2Track.clips[0].name).toBe('Video Clip');
    expect(v2Track.clips[0].startTime).toBe(5);
  });

  it('異なるタイプのトラックを選択中でもコピー元タイプのトラックにペーストされる', () => {
    useTimelineStore.getState().copySelectedClip();

    // audioトラックを選択した状態でペースト
    useTimelineStore.setState({ selectedTrackId: 'a1', currentTime: 15 });
    useTimelineStore.getState().pasteClip();

    const state = useTimelineStore.getState();
    const videoTrack = state.tracks.find(t => t.id === 'v1')!;
    const audioTrack = state.tracks.find(t => t.id === 'a1')!;
    expect(videoTrack.clips).toHaveLength(2);
    expect(audioTrack.clips).toHaveLength(0);
  });
});
