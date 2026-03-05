import type { PluginContext } from './api';

export interface QcutPlugin {
  onInit(context: PluginContext): Promise<void> | void;
  onActivate(): Promise<void> | void;
  onDeactivate(): Promise<void> | void;
  onDestroy?(): Promise<void> | void;
}

export interface WasmExports {
  memory: WebAssembly.Memory;
  alloc(size: number): number;
  dealloc(ptr: number, size: number): void;
  process_frame(input: number, width: number, height: number, output: number): void;
  activate?(): void;
  deactivate?(): void;
}
