import { describe, it, expect } from 'vitest';
import type { ProjectFile } from '../types/projectFile';
import { CURRENT_SCHEMA_VERSION } from '../types/projectFile';

describe('ProjectFile schema', () => {
  const validProject: ProjectFile = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion: '0.1.0',
    createdAt: '2026-03-08T12:00:00.000Z',
    updatedAt: '2026-03-08T12:00:00.000Z',
    metadata: {
      name: 'テストプロジェクト',
    },
    timeline: {
      tracks: [
        {
          id: 'track-1',
          type: 'video',
          name: 'Video 1',
          volume: 1.0,
          mute: false,
          solo: false,
          clips: [
            {
              id: 'clip-1',
              name: 'sample.mp4',
              startTime: 0,
              duration: 10,
              filePath: 'media/sample.mp4',
              sourceStartTime: 0,
              sourceEndTime: 10,
            },
          ],
        },
        {
          id: 'track-2',
          type: 'audio',
          name: 'Audio 1',
          volume: 0.8,
          mute: false,
          solo: false,
          clips: [],
        },
        {
          id: 'track-3',
          type: 'text',
          name: 'Text 1',
          volume: 1.0,
          mute: false,
          solo: false,
          clips: [
            {
              id: 'clip-2',
              name: 'テロップ',
              startTime: 2,
              duration: 3,
              filePath: '',
              sourceStartTime: 0,
              sourceEndTime: 3,
              textProperties: {
                text: 'Hello',
                fontSize: 32,
                fontColor: '#ffffff',
                fontFamily: 'sans-serif',
                bold: false,
                italic: false,
                textAlign: 'center',
                positionX: 50,
                positionY: 85,
                opacity: 1,
                backgroundColor: 'transparent',
                animation: 'none',
                animationDuration: 0.3,
              },
            },
          ],
        },
      ],
      transitions: [],
    },
    exportSettings: {
      format: 'mp4',
      width: 1920,
      height: 1080,
      bitrate: '8M',
      fps: 30,
    },
  };

  it('CURRENT_SCHEMA_VERSION が 3 である', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(3);
  });

  it('有効なプロジェクトファイルが型に適合する', () => {
    expect(validProject.schemaVersion).toBe(3);
    expect(validProject.appVersion).toBe('0.1.0');
    expect(validProject.metadata.name).toBe('テストプロジェクト');
    expect(validProject.timeline.tracks).toHaveLength(3);
    expect(validProject.timeline.transitions).toEqual([]);
  });

  it('タイムラインのトラック型が正しい', () => {
    const types = validProject.timeline.tracks.map((t) => t.type);
    expect(types).toEqual(['video', 'audio', 'text']);
  });

  it('クリップにエフェクト・テキストがオプショナルで設定できる', () => {
    const videoClip = validProject.timeline.tracks[0].clips[0];
    expect(videoClip.effects).toBeUndefined();

    const textClip = validProject.timeline.tracks[2].clips[0];
    expect(textClip.textProperties).toBeDefined();
    expect(textClip.textProperties?.text).toBe('Hello');
  });

  it('エフェクト付きクリップが型に適合する', () => {
    const clipWithEffects: ProjectFile['timeline']['tracks'][0]['clips'][0] = {
      id: 'clip-fx',
      name: 'effects.mp4',
      startTime: 0,
      duration: 5,
      filePath: 'media/effects.mp4',
      sourceStartTime: 0,
      sourceEndTime: 5,
      effects: {
        brightness: 1.2,
        contrast: 1.0,
        saturation: 0.8,
        rotation: 0,
        scaleX: 1.0,
        scaleY: 1.0,
        positionX: 0,
        positionY: 0,
        fadeIn: 0.5,
        fadeOut: 0.5,
        volume: 1.0,
        eqLow: 0,
        eqMid: 0,
        eqHigh: 0,
        denoiseAmount: 0,
        highpassFreq: 0,
        echoDelay: 0,
        echoDecay: 0.3,
        reverbAmount: 0,
        colorTemperature: 0,
        hue: 0,
        hslRedSat: 0,
        hslYellowSat: 0,
        hslGreenSat: 0,
        hslCyanSat: 0,
        hslBlueSat: 0,
        hslMagentaSat: 0,
        liftR: 0,
        liftG: 0,
        liftB: 0,
        gammaR: 0,
        gammaG: 0,
        gammaB: 0,
        gainR: 0,
        gainG: 0,
        gainB: 0,
        blurAmount: 0,
        sharpenAmount: 0,
        monochrome: 0,
      },
    };

    expect(clipWithEffects.effects?.brightness).toBe(1.2);
  });

  it('createdAt / updatedAt が ISO 8601 形式の文字列である', () => {
    expect(() => new Date(validProject.createdAt).toISOString()).not.toThrow();
    expect(() => new Date(validProject.updatedAt).toISOString()).not.toThrow();
  });

  it('metadata.basePath はオプショナルである', () => {
    expect(validProject.metadata.basePath).toBeUndefined();

    const withBasePath: ProjectFile = {
      ...validProject,
      metadata: { name: 'test', basePath: '/Users/test/videos' },
    };
    expect(withBasePath.metadata.basePath).toBe('/Users/test/videos');
  });
});
