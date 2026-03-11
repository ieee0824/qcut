import { describe, it, expect } from 'vitest';
import type { Track } from '../store/timelineStore';
import {
  AUDIO_EXTENSIONS,
  VIDEO_EXTENSIONS,
  isAudioFile,
  getNextTrackId,
  extractFileName,
} from '../components/FileOperations/fileOperationsUtils';

describe('fileOperationsUtils', () => {
  // --- isAudioFile ---

  describe('isAudioFile', () => {
    it.each(AUDIO_EXTENSIONS)('拡張子 .%s を音声ファイルと判定する', (ext) => {
      expect(isAudioFile(`/path/to/file.${ext}`)).toBe(true);
    });

    it.each(AUDIO_EXTENSIONS)('大文字の拡張子 .%s も音声ファイルと判定する', (ext) => {
      expect(isAudioFile(`/path/to/file.${ext.toUpperCase()}`)).toBe(true);
    });

    it.each(VIDEO_EXTENSIONS)('拡張子 .%s を音声ファイルと判定しない', (ext) => {
      expect(isAudioFile(`/path/to/file.${ext}`)).toBe(false);
    });

    it('拡張子がないファイルは音声ファイルと判定しない', () => {
      expect(isAudioFile('/path/to/file')).toBe(false);
    });

    it('空文字列は音声ファイルと判定しない', () => {
      expect(isAudioFile('')).toBe(false);
    });

    it('ドットだけのファイルは音声ファイルと判定しない', () => {
      expect(isAudioFile('/path/to/file.')).toBe(false);
    });
  });

  // --- getNextTrackId ---

  describe('getNextTrackId', () => {
    const makeTrack = (id: string, type: 'video' | 'audio'): Track => ({
      id,
      type,
      name: id,
      clips: [],
      volume: 1.0,
      mute: false,
      solo: false,
    });

    it('トラックがない場合 video-1 を返す', () => {
      expect(getNextTrackId([], 'video')).toBe('video-1');
    });

    it('トラックがない場合 audio-1 を返す', () => {
      expect(getNextTrackId([], 'audio')).toBe('audio-1');
    });

    it('video-1 が存在する場合 video-2 を返す', () => {
      const tracks = [makeTrack('video-1', 'video')];
      expect(getNextTrackId(tracks, 'video')).toBe('video-2');
    });

    it('video-1, video-3 が存在する場合 video-4 を返す（欠番はスキップ）', () => {
      const tracks = [makeTrack('video-1', 'video'), makeTrack('video-3', 'video')];
      expect(getNextTrackId(tracks, 'video')).toBe('video-4');
    });

    it('audio トラックのみ存在する場合 video-1 を返す', () => {
      const tracks = [makeTrack('audio-1', 'audio')];
      expect(getNextTrackId(tracks, 'video')).toBe('video-1');
    });

    it('video と audio が混在する場合、指定タイプのみカウントする', () => {
      const tracks = [
        makeTrack('video-1', 'video'),
        makeTrack('audio-1', 'audio'),
        makeTrack('video-2', 'video'),
      ];
      expect(getNextTrackId(tracks, 'video')).toBe('video-3');
      expect(getNextTrackId(tracks, 'audio')).toBe('audio-2');
    });

    it('IDパターンに合致しないトラックは無視する', () => {
      const tracks = [makeTrack('custom-track', 'video')];
      expect(getNextTrackId(tracks, 'video')).toBe('video-1');
    });
  });

  // --- extractFileName ---

  describe('extractFileName', () => {
    it('Unixパスからファイル名を抽出する', () => {
      expect(extractFileName('/Users/test/videos/sample.mp4')).toBe('sample.mp4');
    });

    it('Windowsパスからファイル名を抽出できない（既知のバグ: Issue #164）', () => {
      // split('/') が先に評価され、バックスラッシュのみのパスではフルパスが返る
      expect(extractFileName('C:\\Users\\test\\videos\\sample.mp4')).toBe('C:\\Users\\test\\videos\\sample.mp4');
    });

    it('ファイル名のみの場合はそのまま返す', () => {
      expect(extractFileName('sample.mp4')).toBe('sample.mp4');
    });

    it('空文字列の場合は空文字列を返す', () => {
      expect(extractFileName('')).toBe('');
    });
  });
});
