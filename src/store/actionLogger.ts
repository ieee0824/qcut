import { invoke } from '@tauri-apps/api/core';

const IGNORED_ACTIONS = new Set([
  'setCurrentTime',
  'setIsPlaying',
  'setPixelsPerSecond',
  'updateClipSilent',
]);

export function logAction(action: string, detail: string = '') {
  if (IGNORED_ACTIONS.has(action)) return;
  invoke('log_action', { action, detail }).catch(() => {});
}
