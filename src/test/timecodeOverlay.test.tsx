import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { DEFAULT_TIMECODE_OVERLAY } from '../store/timeline/types';
import { TimecodePanel } from '../components/Inspector/TimecodePanel';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('DEFAULT_TIMECODE_OVERLAY', () => {
  it('startDateTime が 0 である（モジュール読み込み時の Date.now() に依存しない）', () => {
    expect(DEFAULT_TIMECODE_OVERLAY.startDateTime).toBe(0);
  });

  it('enabled が false である', () => {
    expect(DEFAULT_TIMECODE_OVERLAY.enabled).toBe(false);
  });

  it('デフォルト値が参照透過である（何度読んでも同じ値）', () => {
    const a = { ...DEFAULT_TIMECODE_OVERLAY };
    const b = { ...DEFAULT_TIMECODE_OVERLAY };
    expect(a).toEqual(b);
  });
});

describe('TimecodePanel リセットボタン', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('リセットボタンが onChange を Date.now() の startDateTime で呼び出す', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);

    const onChange = vi.fn();
    const overlay = { ...DEFAULT_TIMECODE_OVERLAY, enabled: true, startDateTime: 9999 };

    const { getByText } = render(
      <TimecodePanel timecodeOverlay={overlay} filePath="/test.mp4" onChange={onChange} />
    );

    const resetButton = getByText(/リセット|reset/i);
    fireEvent.click(resetButton);

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      enabled: true,
      startDateTime: 1700000000000,
    }));
  });
});
