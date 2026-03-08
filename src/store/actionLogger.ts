import { invoke } from '@tauri-apps/api/core';

const IGNORED_ACTIONS = new Set([
  'setCurrentTime',
  'setIsPlaying',
  'setPixelsPerSecond',
  'updateClipSilent',
]);

let pending = false;

export function logAction(action: string, detail: string = '') {
  if (IGNORED_ACTIONS.has(action) || pending) return;
  pending = true;
  invoke('log_action', { action, detail }).catch(() => {}).finally(() => { pending = false; });
}
