import type { ClipEffects } from '../../store/timelineStore';
import type { SliderDefinition } from './PropertySlider';

export const BASIC_SLIDERS: SliderDefinition<keyof ClipEffects>[] = [
  { key: 'brightness', label: 'effects.brightness', min: 0, max: 2, step: 0.01 },
  { key: 'contrast', label: 'effects.contrast', min: 0, max: 2, step: 0.01 },
  { key: 'saturation', label: 'effects.saturation', min: 0, max: 2, step: 0.01 },
  { key: 'colorTemperature', label: 'effects.colorTemperature', min: -1, max: 1, step: 0.01 },
  { key: 'hue', label: 'effects.hue', min: -180, max: 180, step: 1 },
];

export const HSL_SLIDERS: SliderDefinition<keyof ClipEffects>[] = [
  { key: 'hslRedSat', label: 'effects.hslRedSat', min: -1, max: 1, step: 0.01 },
  { key: 'hslYellowSat', label: 'effects.hslYellowSat', min: -1, max: 1, step: 0.01 },
  { key: 'hslGreenSat', label: 'effects.hslGreenSat', min: -1, max: 1, step: 0.01 },
  { key: 'hslCyanSat', label: 'effects.hslCyanSat', min: -1, max: 1, step: 0.01 },
  { key: 'hslBlueSat', label: 'effects.hslBlueSat', min: -1, max: 1, step: 0.01 },
  { key: 'hslMagentaSat', label: 'effects.hslMagentaSat', min: -1, max: 1, step: 0.01 },
];

export const TRANSFORM_SLIDERS: SliderDefinition<keyof ClipEffects>[] = [
  { key: 'rotation', label: 'transform.rotation', min: -180, max: 180, step: 1 },
  { key: 'scaleX', label: 'transform.scaleX', min: 0.1, max: 3, step: 0.01 },
  { key: 'scaleY', label: 'transform.scaleY', min: 0.1, max: 3, step: 0.01 },
  { key: 'positionX', label: 'transform.positionX', min: -500, max: 500, step: 1 },
  { key: 'positionY', label: 'transform.positionY', min: -500, max: 500, step: 1 },
];

export const VOLUME_SLIDERS: SliderDefinition<keyof ClipEffects>[] = [
  { key: 'volume', label: 'effects.volume', min: 0, max: 2, step: 0.01 },
];

export const EQ_SLIDERS: SliderDefinition<keyof ClipEffects>[] = [
  { key: 'eqLow', label: 'effects.eqLow', min: -12, max: 12, step: 0.5 },
  { key: 'eqMid', label: 'effects.eqMid', min: -12, max: 12, step: 0.5 },
  { key: 'eqHigh', label: 'effects.eqHigh', min: -12, max: 12, step: 0.5 },
];

export const NOISE_REDUCTION_SLIDERS: SliderDefinition<keyof ClipEffects>[] = [
  { key: 'denoiseAmount', label: 'effects.denoiseAmount', min: 0, max: 1, step: 0.01 },
  { key: 'highpassFreq', label: 'effects.highpassFreq', min: 0, max: 500, step: 10 },
];

export const ECHO_SLIDERS: SliderDefinition<keyof ClipEffects>[] = [
  { key: 'echoDelay', label: 'effects.echoDelay', min: 0, max: 1000, step: 10 },
  { key: 'echoDecay', label: 'effects.echoDecay', min: 0, max: 0.9, step: 0.01 },
];

export const REVERB_SLIDERS: SliderDefinition<keyof ClipEffects>[] = [
  { key: 'reverbAmount', label: 'effects.reverbAmount', min: 0, max: 1, step: 0.01 },
];

export const FADE_SLIDERS: SliderDefinition<keyof ClipEffects>[] = [
  { key: 'fadeIn', label: 'effects.fadeIn', min: 0, max: 3, step: 0.1 },
  { key: 'fadeOut', label: 'effects.fadeOut', min: 0, max: 3, step: 0.1 },
];
