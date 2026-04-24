import type { PluginNotification } from '@/store/pluginStore';
import type { Disposable } from './types/api';

export interface PluginNotificationInput {
  id: string;
  pluginId: string;
  message: string;
  type: PluginNotification['type'];
  timestamp: number;
}

export function buildPluginNotification(input: PluginNotificationInput): PluginNotification {
  return {
    id: input.id,
    pluginId: input.pluginId,
    message: input.message,
    type: input.type,
    timestamp: input.timestamp,
  };
}

export function createNotificationAutoRemoveDisposable(
  notificationId: string,
  removeNotification: (id: string) => void,
  schedule: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout> = setTimeout,
  cancel: (handle: ReturnType<typeof setTimeout>) => void = clearTimeout,
  delayMs = 5000,
): Disposable {
  const timeoutId = schedule(() => {
    removeNotification(notificationId);
  }, delayMs);

  return {
    dispose: () => {
      cancel(timeoutId);
      removeNotification(notificationId);
    },
  };
}
