import { create } from 'zustand';

export interface ShortcutBinding {
  key: string;        // e.g. 'k', 'z', 'Delete'
  ctrlOrMeta: boolean;
  shift: boolean;
  alt: boolean;
}

export interface ShortcutEntry {
  id: string;
  label: string;      // i18n key
  binding: ShortcutBinding;
}

export const DEFAULT_SHORTCUTS: ShortcutEntry[] = [
  { id: 'playPause',   label: 'shortcut.playPause',   binding: { key: ' ',         ctrlOrMeta: false, shift: false, alt: false } },
  { id: 'split',       label: 'shortcut.split',       binding: { key: 'k',         ctrlOrMeta: true,  shift: false, alt: false } },
  { id: 'undo',        label: 'shortcut.undo',        binding: { key: 'z',         ctrlOrMeta: true,  shift: false, alt: false } },
  { id: 'redo',        label: 'shortcut.redo',        binding: { key: 'z',         ctrlOrMeta: true,  shift: true,  alt: false } },
  { id: 'copy',        label: 'shortcut.copy',        binding: { key: 'c',         ctrlOrMeta: true,  shift: false, alt: false } },
  { id: 'paste',       label: 'shortcut.paste',       binding: { key: 'v',         ctrlOrMeta: true,  shift: false, alt: false } },
  { id: 'delete',      label: 'shortcut.delete',      binding: { key: 'Delete',    ctrlOrMeta: false, shift: false, alt: false } },
  { id: 'deleteAlt',   label: 'shortcut.delete',      binding: { key: 'Backspace', ctrlOrMeta: false, shift: false, alt: false } },
  { id: 'frameNext',   label: 'shortcut.frameNext',   binding: { key: 'ArrowRight',ctrlOrMeta: false, shift: false, alt: false } },
  { id: 'framePrev',   label: 'shortcut.framePrev',   binding: { key: 'ArrowLeft', ctrlOrMeta: false, shift: false, alt: false } },
  { id: 'zoomIn',      label: 'shortcut.zoomIn',      binding: { key: '=',         ctrlOrMeta: false, shift: false, alt: false } },
  { id: 'zoomOut',     label: 'shortcut.zoomOut',      binding: { key: '-',         ctrlOrMeta: false, shift: false, alt: false } },
  { id: 'showHelp',    label: 'shortcut.showHelp',    binding: { key: '?',         ctrlOrMeta: false, shift: true,  alt: false } },
  { id: 'save',        label: 'shortcut.save',        binding: { key: 's',         ctrlOrMeta: true,  shift: false, alt: false } },
  { id: 'saveAs',      label: 'shortcut.saveAs',      binding: { key: 's',         ctrlOrMeta: true,  shift: true,  alt: false } },
  { id: 'openProject', label: 'shortcut.openProject', binding: { key: 'o',         ctrlOrMeta: true,  shift: false, alt: false } },
];

const STORAGE_KEY = 'qcut-shortcuts';

function loadShortcuts(): ShortcutEntry[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as ShortcutEntry[];
      // Merge with defaults to handle newly added shortcuts
      const savedMap = new Map(parsed.map(s => [s.id, s]));
      return DEFAULT_SHORTCUTS.map(d => savedMap.get(d.id) ?? d);
    }
  } catch { /* ignore */ }
  return DEFAULT_SHORTCUTS.map(s => ({ ...s }));
}

export interface ShortcutState {
  shortcuts: ShortcutEntry[];
  helpVisible: boolean;
  updateBinding: (id: string, binding: ShortcutBinding) => void;
  resetToDefaults: () => void;
  setHelpVisible: (visible: boolean) => void;
}

export const useShortcutStore = create<ShortcutState>((set) => ({
  shortcuts: loadShortcuts(),
  helpVisible: false,

  updateBinding: (id, binding) => set((state) => {
    const shortcuts = state.shortcuts.map(s =>
      s.id === id ? { ...s, binding } : s
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
    return { shortcuts };
  }),

  resetToDefaults: () => {
    const shortcuts = DEFAULT_SHORTCUTS.map(s => ({ ...s }));
    localStorage.removeItem(STORAGE_KEY);
    set({ shortcuts });
  },

  setHelpVisible: (visible) => set({ helpVisible: visible }),
}));

/** Check if a KeyboardEvent matches a ShortcutBinding */
export function matchesBinding(e: KeyboardEvent, binding: ShortcutBinding): boolean {
  const ctrlOrMeta = e.ctrlKey || e.metaKey;
  return (
    e.key === binding.key &&
    ctrlOrMeta === binding.ctrlOrMeta &&
    e.shiftKey === binding.shift &&
    e.altKey === binding.alt
  );
}

/** Format a binding for display (e.g. "Ctrl+K") */
export function formatBinding(binding: ShortcutBinding): string {
  const parts: string[] = [];
  if (binding.ctrlOrMeta) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    parts.push(isMac ? 'Cmd' : 'Ctrl');
  }
  if (binding.shift && binding.key.length === 1 && binding.key >= 'a' && binding.key <= 'z') parts.push('Shift');
  else if (binding.shift && binding.key.length > 1) parts.push('Shift');
  if (binding.alt) parts.push('Alt');

  const keyDisplay: Record<string, string> = {
    ' ': 'Space',
    'ArrowLeft': '\u2190',
    'ArrowRight': '\u2192',
    'ArrowUp': '\u2191',
    'ArrowDown': '\u2193',
    'Delete': 'Del',
    'Backspace': 'Backspace',
    '=': '+',
    '-': '-',
    '?': '?',
  };
  parts.push(keyDisplay[binding.key] ?? binding.key.toUpperCase());
  return parts.join('+');
}
