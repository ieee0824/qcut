import { describe, expect, it, vi } from 'vitest';
import {
  clearAutosaveFilePath,
  createAutosaveRuntimeState,
  finishAutosaveRecovery,
  getAutosaveFilePath,
  resetAutosaveRuntimeState,
  scheduleAutosaveTimer,
  setAutosaveFilePath,
  startAutosaveRecovery,
  stopAutosaveTimer,
} from '../store/projectAutosaveRuntime';

describe('projectAutosaveRuntime', () => {
  it('schedules autosave by replacing the previous timer', () => {
    const runtime = createAutosaveRuntimeState();
    const schedule = vi.fn<((callback: () => void, delayMs: number) => number)>()
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(2);
    const cancel = vi.fn();
    const callback = vi.fn();

    scheduleAutosaveTimer(runtime, schedule, cancel, callback, 5000);
    scheduleAutosaveTimer(runtime, schedule, cancel, callback, 5000);

    expect(cancel).toHaveBeenCalledWith(1);
    expect(runtime.timerId).toBe(2);
  });

  it('clears timer state after the scheduled callback runs', () => {
    const runtime = createAutosaveRuntimeState();
    let scheduledCallback: (() => void) | undefined;
    const schedule = vi.fn((callback: () => void) => {
      scheduledCallback = callback;
      return 3;
    });
    const cancel = vi.fn();
    const callback = vi.fn();

    scheduleAutosaveTimer(runtime, schedule, cancel, callback, 5000);
    scheduledCallback?.();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(runtime.timerId).toBeNull();
  });

  it('tracks recovery entry and exit explicitly', () => {
    const runtime = createAutosaveRuntimeState();

    expect(startAutosaveRecovery(runtime)).toBe(true);
    expect(startAutosaveRecovery(runtime)).toBe(false);

    finishAutosaveRecovery(runtime);

    expect(startAutosaveRecovery(runtime)).toBe(true);
  });

  it('stores and clears autosave file paths explicitly', () => {
    const runtime = createAutosaveRuntimeState();

    setAutosaveFilePath(runtime, '/tmp/autosave.qcut');
    expect(getAutosaveFilePath(runtime)).toBe('/tmp/autosave.qcut');

    clearAutosaveFilePath(runtime);
    expect(getAutosaveFilePath(runtime)).toBeNull();
  });

  it('resetAutosaveRuntimeState clears both timer and runtime flags', () => {
    const runtime = createAutosaveRuntimeState();
    runtime.timerId = 10;
    runtime.filePath = '/tmp/autosave.qcut';
    runtime.isRecovering = true;
    const cancel = vi.fn();

    resetAutosaveRuntimeState(runtime, cancel);

    expect(cancel).toHaveBeenCalledWith(10);
    expect(runtime).toEqual({
      timerId: null,
      filePath: null,
      isRecovering: false,
    });
  });

  it('stopAutosaveTimer is a no-op when no timer exists', () => {
    const runtime = createAutosaveRuntimeState();
    const cancel = vi.fn();

    stopAutosaveTimer(runtime, cancel);

    expect(cancel).not.toHaveBeenCalled();
    expect(runtime.timerId).toBeNull();
  });
});
