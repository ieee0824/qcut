import { invoke } from '@tauri-apps/api/core';
import type { ShortcutBinding } from '../store/shortcutStore';

/** ショートカット ID → ネイティブメニューアイテム ID */
export const SHORTCUT_TO_MENU_ITEM: Record<string, string> = {
  undo:        'edit.undo',
  redo:        'edit.redo',
  copy:        'edit.copy',
  paste:       'edit.paste',
  save:        'file.saveProject',
  saveAs:      'file.saveProjectAs',
  openProject: 'file.openProject',
};

const KEY_TO_ACCEL: Record<string, string> = {
  ' ':          'Space',
  'ArrowLeft':  'Left',
  'ArrowRight': 'Right',
  'ArrowUp':    'Up',
  'ArrowDown':  'Down',
  'Delete':     'Delete',
  'Backspace':  'Backspace',
  'Tab':        'Tab',
  'Enter':      'Return',
  'Escape':     'Escape',
};

export function bindingToAccelerator(b: ShortcutBinding): string {
  const parts: string[] = [];
  if (b.ctrlOrMeta) parts.push('CmdOrCtrl');
  if (b.alt)        parts.push('Alt');
  if (b.shift)      parts.push('Shift');
  parts.push(KEY_TO_ACCEL[b.key] ?? b.key.toUpperCase());
  return parts.join('+');
}

export function syncMenuAccelerator(id: string, binding: ShortcutBinding): void {
  const menuItemId = SHORTCUT_TO_MENU_ITEM[id];
  if (!menuItemId) return;
  invoke('update_menu_accelerator', {
    itemId: menuItemId,
    accelerator: bindingToAccelerator(binding),
  }).catch(() => {});
}

export function syncAllMenuAccelerators(shortcuts: Array<{ id: string; binding: ShortcutBinding }>): void {
  for (const s of shortcuts) {
    syncMenuAccelerator(s.id, s.binding);
  }
}
