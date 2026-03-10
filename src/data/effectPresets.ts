import type { ClipEffects } from '../store/timelineStore';

export type EffectPresetCategory = 'voice' | 'music' | 'scene' | 'custom';

export interface EffectPreset {
  id: string;
  name: string;
  category: EffectPresetCategory;
  effects: Partial<ClipEffects>;
  isBuiltIn: boolean;
}

export const BUILT_IN_EFFECT_PRESETS: EffectPreset[] = [
  // ボイス・ダイアログ
  {
    id: 'builtin-voice-dialog',
    name: 'effectPreset.voiceDialog',
    category: 'voice',
    isBuiltIn: true,
    effects: {
      eqLow: -2,
      eqMid: 4,
      eqHigh: 2,
      highpassFreq: 80,
      denoiseAmount: 0.2,
      volume: 1.1,
    },
  },
  {
    id: 'builtin-voice-podcast',
    name: 'effectPreset.voicePodcast',
    category: 'voice',
    isBuiltIn: true,
    effects: {
      eqLow: -4,
      eqMid: 3,
      eqHigh: 1,
      highpassFreq: 100,
      denoiseAmount: 0.4,
      volume: 1.2,
    },
  },
  // ミュージック
  {
    id: 'builtin-music-bgm',
    name: 'effectPreset.musicBGM',
    category: 'music',
    isBuiltIn: true,
    effects: {
      eqLow: 3,
      eqMid: 0,
      eqHigh: 1,
      volume: 0.8,
    },
  },
  {
    id: 'builtin-music-live',
    name: 'effectPreset.musicLive',
    category: 'music',
    isBuiltIn: true,
    effects: {
      eqLow: 4,
      eqMid: 0,
      eqHigh: 2,
      reverbAmount: 0.4,
      volume: 0.9,
    },
  },
  // シーン（映像＋音声の組み合わせ）
  {
    id: 'builtin-scene-cinema',
    name: 'effectPreset.sceneCinema',
    category: 'scene',
    isBuiltIn: true,
    effects: {
      contrast: 1.15,
      saturation: 0.85,
      colorTemperature: 0.1,
      liftR: 0.02,
      liftG: -0.01,
      liftB: -0.02,
      gainR: 0.04,
      gainG: 0.01,
      gainB: -0.02,
      eqLow: 1,
      eqMid: 0,
      eqHigh: -1,
    },
  },
  {
    id: 'builtin-scene-documentary',
    name: 'effectPreset.sceneDocumentary',
    category: 'scene',
    isBuiltIn: true,
    effects: {
      saturation: 0.75,
      contrast: 1.05,
      eqLow: -2,
      eqMid: 2,
      eqHigh: 1,
      highpassFreq: 60,
      denoiseAmount: 0.2,
    },
  },
];
