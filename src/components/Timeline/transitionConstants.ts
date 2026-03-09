import type { TransitionType } from '../../store/timelineStore';

export const TRANSITION_TYPES: TransitionType[] = [
  'crossfade',
  'dissolve',
  'wipe-left',
  'wipe-right',
  'wipe-up',
  'wipe-down',
];

export const TRANSITION_I18N_KEYS: Record<TransitionType, string> = {
  'crossfade': 'transition.crossfade',
  'dissolve': 'transition.dissolve',
  'wipe-left': 'transition.wipeLeft',
  'wipe-right': 'transition.wipeRight',
  'wipe-up': 'transition.wipeUp',
  'wipe-down': 'transition.wipeDown',
};
