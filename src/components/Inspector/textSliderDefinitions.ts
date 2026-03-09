import type { TextProperties } from '../../store/timelineStore';
import type { SliderDefinition } from './PropertySlider';

export const FONT_SIZE_SLIDER: SliderDefinition<keyof TextProperties> =
  { key: 'fontSize', label: 'text.fontSize', min: 16, max: 120, step: 1, decimals: 0, suffix: 'px' };

export const POSITION_SLIDERS: SliderDefinition<keyof TextProperties>[] = [
  { key: 'positionX', label: 'text.positionX', min: 0, max: 100, step: 1, decimals: 0, suffix: '%' },
  { key: 'positionY', label: 'text.positionY', min: 0, max: 100, step: 1, decimals: 0, suffix: '%' },
  { key: 'opacity', label: 'text.opacity', min: 0, max: 1, step: 0.01, decimals: 2 },
];

export const ANIMATION_DURATION_SLIDER: SliderDefinition<keyof TextProperties> =
  { key: 'animationDuration', label: 'text.animationDuration', min: 0.1, max: 2, step: 0.1, decimals: 1, suffix: 's' };
