import type { ClipEffects } from '../store/timelineStore';

/** カラープリセットが制御するエフェクトフィールド（トランスフォーム・オーディオ系を除外） */
export type ColorEffectFields = Pick<ClipEffects,
  'brightness' | 'contrast' | 'saturation' | 'colorTemperature' | 'hue' |
  'hslRedSat' | 'hslYellowSat' | 'hslGreenSat' | 'hslCyanSat' | 'hslBlueSat' | 'hslMagentaSat' |
  'liftR' | 'liftG' | 'liftB' | 'gammaR' | 'gammaG' | 'gammaB' | 'gainR' | 'gainG' | 'gainB'
>;

export type ColorPresetCategory = 'cinematic' | 'vintage' | 'monochrome' | 'creative' | 'custom';

export interface ColorPreset {
  id: string;
  name: string;
  category: ColorPresetCategory;
  effects: Partial<ColorEffectFields>;
  isBuiltIn: boolean;
}

export const BUILT_IN_COLOR_PRESETS: ColorPreset[] = [
  // シネマティック
  {
    id: 'builtin-cinematic-warm',
    name: 'colorPreset.cinematicWarm',
    category: 'cinematic',
    isBuiltIn: true,
    effects: {
      contrast: 1.15,
      saturation: 0.85,
      colorTemperature: 0.15,
      liftR: 0.02, liftG: -0.01, liftB: -0.03,
      gainR: 0.05, gainG: 0.02, gainB: -0.03,
    },
  },
  {
    id: 'builtin-cinematic-cool',
    name: 'colorPreset.cinematicCool',
    category: 'cinematic',
    isBuiltIn: true,
    effects: {
      contrast: 1.15,
      saturation: 0.85,
      colorTemperature: -0.15,
      liftR: -0.03, liftG: -0.01, liftB: 0.03,
      gainR: -0.02, gainG: 0.01, gainB: 0.05,
    },
  },
  {
    id: 'builtin-teal-orange',
    name: 'colorPreset.tealOrange',
    category: 'cinematic',
    isBuiltIn: true,
    effects: {
      contrast: 1.1,
      saturation: 1.1,
      hslCyanSat: 0.4,
      hslBlueSat: 0.2,
      hslRedSat: 0.3,
      hslYellowSat: 0.2,
      liftR: -0.02, liftG: -0.01, liftB: 0.04,
      gainR: 0.06, gainG: 0.02, gainB: -0.04,
    },
  },
  // ビンテージ
  {
    id: 'builtin-vintage-film',
    name: 'colorPreset.vintageFilm',
    category: 'vintage',
    isBuiltIn: true,
    effects: {
      contrast: 0.9,
      saturation: 0.7,
      colorTemperature: 0.1,
      liftR: 0.05, liftG: 0.03, liftB: 0.0,
      gammaR: 0.02, gammaG: 0.01, gammaB: -0.02,
    },
  },
  {
    id: 'builtin-faded-pastel',
    name: 'colorPreset.fadedPastel',
    category: 'vintage',
    isBuiltIn: true,
    effects: {
      brightness: 1.05,
      contrast: 0.85,
      saturation: 0.6,
      liftR: 0.04, liftG: 0.03, liftB: 0.05,
    },
  },
  {
    id: 'builtin-sepia',
    name: 'colorPreset.sepia',
    category: 'vintage',
    isBuiltIn: true,
    effects: {
      saturation: 0.3,
      colorTemperature: 0.25,
      liftR: 0.06, liftG: 0.03, liftB: -0.02,
      gammaR: 0.03, gammaG: 0.01, gammaB: -0.03,
    },
  },
  // モノクロ
  {
    id: 'builtin-monochrome',
    name: 'colorPreset.monochrome',
    category: 'monochrome',
    isBuiltIn: true,
    effects: {
      saturation: 0.0,
      contrast: 1.1,
    },
  },
  {
    id: 'builtin-high-contrast-bw',
    name: 'colorPreset.highContrastBW',
    category: 'monochrome',
    isBuiltIn: true,
    effects: {
      saturation: 0.0,
      contrast: 1.4,
      brightness: 1.05,
    },
  },
  // クリエイティブ
  {
    id: 'builtin-bleach-bypass',
    name: 'colorPreset.bleachBypass',
    category: 'creative',
    isBuiltIn: true,
    effects: {
      saturation: 0.5,
      contrast: 1.3,
      brightness: 0.95,
    },
  },
  {
    id: 'builtin-vibrant',
    name: 'colorPreset.vibrant',
    category: 'creative',
    isBuiltIn: true,
    effects: {
      saturation: 1.4,
      contrast: 1.1,
      hslRedSat: 0.2,
      hslBlueSat: 0.2,
      hslGreenSat: 0.2,
    },
  },
];
