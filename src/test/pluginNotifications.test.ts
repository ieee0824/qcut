import { describe, expect, it, vi } from 'vitest';
import {
  buildPluginNotification,
  createNotificationAutoRemoveDisposable,
} from '../plugin-system/notifications';

describe('plugin notifications helpers', () => {
  it('buildPluginNotification returns the expected payload deterministically', () => {
    const notification = buildPluginNotification({
      id: 'notif-1',
      pluginId: 'plugin.test',
      message: 'hello',
      type: 'warning',
      timestamp: 12345,
    });

    expect(notification).toEqual({
      id: 'notif-1',
      pluginId: 'plugin.test',
      message: 'hello',
      type: 'warning',
      timestamp: 12345,
    });
  });

  it('createNotificationAutoRemoveDisposable schedules and removes by id', () => {
    const removeNotification = vi.fn();
    let scheduledCallback: (() => void) | undefined;
    const schedule = vi.fn((callback: () => void, delayMs: number) => {
      scheduledCallback = callback;
      expect(delayMs).toBe(5000);
      return 42 as ReturnType<typeof setTimeout>;
    });
    const cancel = vi.fn();

    const disposable = createNotificationAutoRemoveDisposable(
      'notif-1',
      removeNotification,
      schedule,
      cancel,
    );

    expect(schedule).toHaveBeenCalledTimes(1);
    expect(removeNotification).not.toHaveBeenCalled();

    scheduledCallback?.();
    expect(removeNotification).toHaveBeenCalledWith('notif-1');

    disposable.dispose();
    expect(cancel).toHaveBeenCalledWith(42);
    expect(removeNotification).toHaveBeenLastCalledWith('notif-1');
  });
});
