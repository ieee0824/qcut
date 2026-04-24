import { describe, it, expect } from 'vitest';
import { resolveTargetTrackId, buildPastedClip } from '../store/timeline/clipboardSlice';
import type { Track, Clip } from '../store/timeline/types';
import { DEFAULT_EFFECTS } from '../store/timeline/types';

function makeTrack(id: string, type: Track['type']): Track {
  return { id, type, name: `Track ${id}`, clips: [] };
}

function makeClip(id: string): Clip {
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
});
