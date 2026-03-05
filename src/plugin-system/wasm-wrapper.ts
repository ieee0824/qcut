import type { PluginManifest } from './types/manifest';
import type { PluginContext } from './types/api';
import type { QcutPlugin, WasmExports } from './types/plugin';

export class WasmPluginWrapper implements QcutPlugin {
  private instance: WebAssembly.Instance | null = null;
  private memory: WebAssembly.Memory | null = null;
  private context: PluginContext | null = null;

  constructor(
    private wasmBytes: ArrayBuffer,
    private manifest: PluginManifest,
  ) {}

  async onInit(context: PluginContext): Promise<void> {
    this.context = context;

    const textDecoder = new TextDecoder();

    const importObject = {
      env: {
        log_info: (ptr: number, len: number) => {
          const msg = this.readString(ptr, len, textDecoder);
          context.log.info(msg);
        },
        log_warn: (ptr: number, len: number) => {
          const msg = this.readString(ptr, len, textDecoder);
          context.log.warn(msg);
        },
        log_error: (ptr: number, len: number) => {
          const msg = this.readString(ptr, len, textDecoder);
          context.log.error(msg);
        },
      },
    };

    const result = await WebAssembly.instantiate(this.wasmBytes, importObject);
    this.instance = result.instance;
    this.memory = result.instance.exports.memory as WebAssembly.Memory;
  }

  onActivate(): void {
    const exports = this.getExports();
    if (exports.activate) {
      exports.activate();
    }
  }

  onDeactivate(): void {
    const exports = this.getExports();
    if (exports.deactivate) {
      exports.deactivate();
    }
  }

  onDestroy(): void {
    this.instance = null;
    this.memory = null;
    this.context = null;
  }

  processFrame(imageData: ImageData): ImageData {
    const exports = this.getExports();
    const inputSize = imageData.data.byteLength;

    const inputPtr = exports.alloc(inputSize);
    const outputPtr = exports.alloc(inputSize);

    try {
      const memView = new Uint8Array(exports.memory.buffer);
      memView.set(imageData.data, inputPtr);

      exports.process_frame(inputPtr, imageData.width, imageData.height, outputPtr);

      const outputData = new Uint8ClampedArray(
        exports.memory.buffer.slice(outputPtr, outputPtr + inputSize),
      );

      return new ImageData(outputData, imageData.width, imageData.height);
    } finally {
      exports.dealloc(inputPtr, inputSize);
      exports.dealloc(outputPtr, inputSize);
    }
  }

  get pluginManifest(): PluginManifest {
    return this.manifest;
  }

  private getExports(): WasmExports {
    if (!this.instance) {
      throw new Error(`[${this.manifest.id}] WASM が初期化されていません`);
    }
    return this.instance.exports as unknown as WasmExports;
  }

  private readString(ptr: number, len: number, decoder: TextDecoder): string {
    if (!this.memory) return '';
    const bytes = new Uint8Array(this.memory.buffer, ptr, len);
    return decoder.decode(bytes);
  }
}
