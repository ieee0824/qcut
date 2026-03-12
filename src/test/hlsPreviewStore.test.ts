import { describe, it, expect } from 'vitest';
import { hlsToTimeline, timelineToHls, type HlsSegment } from '@/store/hlsPreviewStore';

const segments: HlsSegment[] = [
  { hlsStart: 0, timelineStart: 0, duration: 5 },
  { hlsStart: 5, timelineStart: 7, duration: 3 }, // gap: timeline 5-7 はクリップなし
];

describe('hlsToTimeline', () => {
  it('HLS 時刻 0 → タイムライン 0', () => {
    expect(hlsToTimeline(0, segments)).toBe(0);
  });

  it('HLS 時刻 2.5 → タイムライン 2.5（第1セグメント内）', () => {
    expect(hlsToTimeline(2.5, segments)).toBe(2.5);
  });

  it('HLS 時刻 5 → タイムライン 7（第2セグメント先頭）', () => {
    expect(hlsToTimeline(5, segments)).toBe(7);
  });

  it('HLS 時刻 6 → タイムライン 8（第2セグメント内）', () => {
    expect(hlsToTimeline(6, segments)).toBe(8);
  });

  it('HLS 時刻が末尾を超えた場合は最終セグメントの終端を返す', () => {
    expect(hlsToTimeline(100, segments)).toBe(10);
  });
});

describe('timelineToHls', () => {
  it('タイムライン 0 → HLS 0', () => {
    expect(timelineToHls(0, segments)).toBe(0);
  });

  it('タイムライン 2.5 → HLS 2.5（第1セグメント内）', () => {
    expect(timelineToHls(2.5, segments)).toBe(2.5);
  });

  it('タイムライン 7 → HLS 5（第2セグメント先頭）', () => {
    expect(timelineToHls(7, segments)).toBe(5);
  });

  it('タイムライン 8 → HLS 6（第2セグメント内）', () => {
    expect(timelineToHls(8, segments)).toBe(6);
  });

  it('gap 区間（タイムライン 6）は null を返す', () => {
    expect(timelineToHls(6, segments)).toBeNull();
  });

  it('タイムラインが末尾を超えた場合は最終セグメントの終端を返す', () => {
    // 最終セグメント: hlsStart=5, duration=3 → HLS 終端は 8
    expect(timelineToHls(100, segments)).toBe(8);
  });
});
