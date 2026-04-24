import { describe, it, expect } from 'vitest';
import {
  parseSRT,
  exportSRT,
  parseASS,
  exportASS,
  subtitlesToTrack,
  trackToSubtitles,
} from '../utils/subtitles';
import type { SubtitleEntry } from '../utils/subtitles';

describe('subtitlesToTrack', () => {
  const entries: SubtitleEntry[] = [
    { startTime: 0, endTime: 2, text: 'Hello' },
    { startTime: 3, endTime: 5, text: 'World' },
  ];

  it('固定IDジェネレータを渡すと決定的なIDを生成する', () => {
    let counter = 0;
    const idGen = (prefix: string) => `${prefix}-fixed-${counter++}`;

    const track = subtitlesToTrack(entries, 'Test', idGen);

    expect(track.id).toBe('track-text-fixed-2');
    expect(track.clips[0].id).toBe('text-fixed-0');
    expect(track.clips[1].id).toBe('text-fixed-1');
  });

  it('IDジェネレータを省略してもトラックが生成される', () => {
    const track = subtitlesToTrack(entries, 'Test');

    expect(track.id).toMatch(/^track-text-/);
    expect(track.clips).toHaveLength(2);
    expect(track.clips[0].id).toMatch(/^text-/);
  });

  it('クリップのプロパティが正しくマッピングされる', () => {
    const idGen = (prefix: string) => `${prefix}-id`;
    const track = subtitlesToTrack(entries, 'Sub', idGen);

    expect(track.type).toBe('text');
    expect(track.name).toBe('Sub');
    expect(track.clips[0].name).toBe('Hello');
    expect(track.clips[0].startTime).toBe(0);
    expect(track.clips[0].duration).toBe(2);
    expect(track.clips[1].name).toBe('World');
    expect(track.clips[1].startTime).toBe(3);
    expect(track.clips[1].duration).toBe(2);
  });

  it('テキストプロパティにentryのtextが設定される', () => {
    const idGen = (prefix: string) => `${prefix}-id`;
    const track = subtitlesToTrack(entries, 'Sub', idGen);

    expect(track.clips[0].textProperties?.text).toBe('Hello');
    expect(track.clips[1].textProperties?.text).toBe('World');
  });

  it('空の配列を渡すとクリップなしのトラックを返す', () => {
    const idGen = (prefix: string) => `${prefix}-id`;
    const track = subtitlesToTrack([], 'Empty', idGen);

    expect(track.clips).toHaveLength(0);
    expect(track.type).toBe('text');
  });
});

describe('trackToSubtitles', () => {
  it('クリップからSubtitleEntryに正しく変換する', () => {
    const idGen = (prefix: string) => `${prefix}-id`;
    const entries: SubtitleEntry[] = [
      { startTime: 1, endTime: 3, text: 'Test subtitle' },
    ];
    const track = subtitlesToTrack(entries, 'Sub', idGen);
    const result = trackToSubtitles(track);

    expect(result).toHaveLength(1);
    expect(result[0].startTime).toBe(1);
    expect(result[0].endTime).toBe(3);
    expect(result[0].text).toBe('Test subtitle');
  });
});

describe('parseSRT / exportSRT', () => {
  const srtContent = `1
00:00:01,000 --> 00:00:03,500
Hello World

2
00:00:05,000 --> 00:00:08,000
Second line
`;

  it('SRTをパースできる', () => {
    const entries = parseSRT(srtContent);
    expect(entries).toHaveLength(2);
    expect(entries[0].startTime).toBe(1);
    expect(entries[0].endTime).toBeCloseTo(3.5);
    expect(entries[0].text).toBe('Hello World');
    expect(entries[1].startTime).toBe(5);
    expect(entries[1].endTime).toBe(8);
  });

  it('SRTにエクスポートできる', () => {
    const entries: SubtitleEntry[] = [
      { startTime: 1, endTime: 3.5, text: 'Hello World' },
    ];
    const result = exportSRT(entries);
    expect(result).toContain('00:00:01,000 --> 00:00:03,500');
    expect(result).toContain('Hello World');
  });
});

describe('parseASS / exportASS', () => {
  const assContent = `[Script Info]
Title: Test

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.50,Default,,0,0,0,,Hello World
`;

  it('ASSをパースできる', () => {
    const entries = parseASS(assContent);
    expect(entries).toHaveLength(1);
    expect(entries[0].startTime).toBe(1);
    expect(entries[0].endTime).toBeCloseTo(3.5);
    expect(entries[0].text).toBe('Hello World');
  });

  it('ASSにエクスポートできる', () => {
    const entries: SubtitleEntry[] = [
      { startTime: 1, endTime: 3.5, text: 'Hello World' },
    ];
    const result = exportASS(entries);
    expect(result).toContain('[Events]');
    expect(result).toContain('Hello World');
  });
});
