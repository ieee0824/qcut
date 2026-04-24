export interface AutosaveRuntimeState {
  timerId: number | null;
  filePath: string | null;
  isRecovering: boolean;
}

export function createAutosaveRuntimeState(): AutosaveRuntimeState {
  return {
    timerId: null,
    filePath: null,
    isRecovering: false,
  };
}

export function resetAutosaveRuntimeState(
  runtime: AutosaveRuntimeState,
  cancel: (timerId: number) => void = clearTimeout,
): void {
  if (runtime.timerId !== null) {
    cancel(runtime.timerId);
  }
  runtime.timerId = null;
  runtime.filePath = null;
  runtime.isRecovering = false;
}

export function stopAutosaveTimer(
  runtime: AutosaveRuntimeState,
  cancel: (timerId: number) => void = clearTimeout,
): void {
  if (runtime.timerId === null) return;
  cancel(runtime.timerId);
  runtime.timerId = null;
}

export function scheduleAutosaveTimer(
  runtime: AutosaveRuntimeState,
  schedule: (callback: () => void, delayMs: number) => number,
  cancel: (timerId: number) => void,
  callback: () => void,
  delayMs: number,
): void {
  stopAutosaveTimer(runtime, cancel);
  runtime.timerId = schedule(() => {
    runtime.timerId = null;
    callback();
  }, delayMs);
}

export function startAutosaveRecovery(runtime: AutosaveRuntimeState): boolean {
  if (runtime.isRecovering) return false;
  runtime.isRecovering = true;
  return true;
}

export function finishAutosaveRecovery(runtime: AutosaveRuntimeState): void {
  runtime.isRecovering = false;
}

export function getAutosaveFilePath(runtime: AutosaveRuntimeState): string | null {
  return runtime.filePath;
}

export function setAutosaveFilePath(runtime: AutosaveRuntimeState, filePath: string): void {
  runtime.filePath = filePath;
}

export function clearAutosaveFilePath(runtime: AutosaveRuntimeState): void {
  runtime.filePath = null;
}
