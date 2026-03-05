import type { Clip, Track } from '@/store/timelineStore';
import type { PluginManifest } from './manifest';

export interface Disposable {
  dispose(): void;
}

export interface ClipChangeEvent {
  type: 'added' | 'removed' | 'updated';
  trackId: string;
  clipId: string;
  clip?: Clip;
}

export interface PanelConfig {
  id: string;
  title: string;
  location: 'sidebar' | 'bottom' | 'floating';
  render: (container: HTMLElement) => void | (() => void);
}

export interface ToolbarButtonConfig {
  id: string;
  label: string;
  icon?: string;
  onClick: () => void;
}

export interface PluginTimelineApi {
  getTracks(): readonly Track[];
  getClipById(clipId: string): Clip | null;
  getCurrentTime(): number;
  onTimeChange(callback: (time: number) => void): Disposable;
  onClipChange(callback: (event: ClipChangeEvent) => void): Disposable;
  addClip(trackId: string, clip: Omit<Clip, 'id'>): string;
  updateClip(trackId: string, clipId: string, updates: Partial<Clip>): void;
  removeClip(trackId: string, clipId: string): void;
}

export interface PluginPreviewApi {
  getCurrentFrameData(): ImageData | null;
  onFrameRender(callback: (frame: ImageData) => ImageData): Disposable;
}

export interface PluginUiApi {
  registerPanel(config: PanelConfig): Disposable;
  registerToolbarButton(config: ToolbarButtonConfig): Disposable;
  showNotification(message: string, type: 'info' | 'warning' | 'error'): void;
}

export interface PluginSettingsApi {
  get<T>(key: string, defaultValue: T): T;
  set(key: string, value: unknown): void;
  onChange(key: string, callback: (value: unknown) => void): Disposable;
}

export interface PluginLogApi {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface PluginContext {
  readonly pluginId: string;
  readonly manifest: Readonly<PluginManifest>;
  readonly timeline: PluginTimelineApi;
  readonly preview: PluginPreviewApi;
  readonly ui: PluginUiApi;
  readonly settings: PluginSettingsApi;
  readonly log: PluginLogApi;
}
