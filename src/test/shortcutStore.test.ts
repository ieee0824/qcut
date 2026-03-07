import { describe, it, expect, beforeEach } from 'vitest';
import { useShortcutStore, matchesBinding, formatBinding, DEFAULT_SHORTCUTS } from '../store/shortcutStore';
import type { ShortcutBinding } from '../store/shortcutStore';

// Provide a minimal localStorage polyfill for test environment
if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.removeItem !== 'function') {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

describe('shortcutStore', () => {
  beforeEach(() => {
    useShortcutStore.setState({
      shortcuts: DEFAULT_SHORTCUTS.map(s => ({ ...s })),
      helpVisible: false,
    });
    localStorage.removeItem('qcut-shortcuts');
  });

  it('should have default shortcuts', () => {
    const state = useShortcutStore.getState();
    expect(state.shortcuts.length).toBe(DEFAULT_SHORTCUTS.length);
    expect(state.shortcuts.find(s => s.id === 'playPause')).toBeDefined();
    expect(state.shortcuts.find(s => s.id === 'undo')).toBeDefined();
  });

  it('should update a binding', () => {
    const { updateBinding } = useShortcutStore.getState();
    const newBinding: ShortcutBinding = { key: 'p', ctrlOrMeta: false, shift: false, alt: false };
    updateBinding('playPause', newBinding);

    const state = useShortcutStore.getState();
    const entry = state.shortcuts.find(s => s.id === 'playPause');
    expect(entry!.binding).toEqual(newBinding);
  });

  it('should persist to localStorage', () => {
    const { updateBinding } = useShortcutStore.getState();
    const newBinding: ShortcutBinding = { key: 'p', ctrlOrMeta: false, shift: false, alt: false };
    updateBinding('playPause', newBinding);

    const saved = JSON.parse(localStorage.getItem('qcut-shortcuts')!);
    const entry = saved.find((s: { id: string }) => s.id === 'playPause');
    expect(entry.binding.key).toBe('p');
  });

  it('should reset to defaults', () => {
    const { updateBinding, resetToDefaults } = useShortcutStore.getState();
    updateBinding('playPause', { key: 'p', ctrlOrMeta: false, shift: false, alt: false });
    resetToDefaults();

    const state = useShortcutStore.getState();
    const entry = state.shortcuts.find(s => s.id === 'playPause');
    expect(entry!.binding.key).toBe(' ');
    expect(localStorage.getItem('qcut-shortcuts')).toBeNull();
  });

  it('should toggle help visibility', () => {
    const { setHelpVisible } = useShortcutStore.getState();
    setHelpVisible(true);
    expect(useShortcutStore.getState().helpVisible).toBe(true);
    setHelpVisible(false);
    expect(useShortcutStore.getState().helpVisible).toBe(false);
  });
});

describe('matchesBinding', () => {
  function makeEvent(overrides: Partial<KeyboardEvent>): KeyboardEvent {
    return {
      key: '',
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      ...overrides,
    } as KeyboardEvent;
  }

  it('should match simple key', () => {
    const binding: ShortcutBinding = { key: ' ', ctrlOrMeta: false, shift: false, alt: false };
    expect(matchesBinding(makeEvent({ key: ' ' }), binding)).toBe(true);
  });

  it('should match ctrl+key', () => {
    const binding: ShortcutBinding = { key: 'z', ctrlOrMeta: true, shift: false, alt: false };
    expect(matchesBinding(makeEvent({ key: 'z', ctrlKey: true }), binding)).toBe(true);
    expect(matchesBinding(makeEvent({ key: 'z', metaKey: true }), binding)).toBe(true);
  });

  it('should not match when modifier missing', () => {
    const binding: ShortcutBinding = { key: 'z', ctrlOrMeta: true, shift: false, alt: false };
    expect(matchesBinding(makeEvent({ key: 'z' }), binding)).toBe(false);
  });

  it('should match ctrl+shift+key', () => {
    const binding: ShortcutBinding = { key: 'z', ctrlOrMeta: true, shift: true, alt: false };
    expect(matchesBinding(makeEvent({ key: 'z', ctrlKey: true, shiftKey: true }), binding)).toBe(true);
  });

  it('should not match when extra shift', () => {
    const binding: ShortcutBinding = { key: 'z', ctrlOrMeta: true, shift: false, alt: false };
    expect(matchesBinding(makeEvent({ key: 'z', ctrlKey: true, shiftKey: true }), binding)).toBe(false);
  });
});

describe('formatBinding', () => {
  it('should format simple key', () => {
    expect(formatBinding({ key: ' ', ctrlOrMeta: false, shift: false, alt: false })).toBe('Space');
  });

  it('should format ctrl+key', () => {
    const result = formatBinding({ key: 'z', ctrlOrMeta: true, shift: false, alt: false });
    expect(result).toMatch(/^(Ctrl|Cmd)\+Z$/);
  });

  it('should format ctrl+shift+key', () => {
    const result = formatBinding({ key: 'z', ctrlOrMeta: true, shift: true, alt: false });
    expect(result).toMatch(/^(Ctrl|Cmd)\+Shift\+Z$/);
  });

  it('should format arrow keys', () => {
    expect(formatBinding({ key: 'ArrowLeft', ctrlOrMeta: false, shift: false, alt: false })).toBe('\u2190');
    expect(formatBinding({ key: 'ArrowRight', ctrlOrMeta: false, shift: false, alt: false })).toBe('\u2192');
  });
});
