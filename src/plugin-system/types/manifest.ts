export type PluginPermission =
  | 'timeline:read'
  | 'timeline:write'
  | 'preview:read'
  | 'preview:write'
  | 'file:read'
  | 'file:write'
  | 'settings:read'
  | 'settings:write'
  | 'ui:panel'
  | 'ui:toolbar'
  | 'frame:process';

export type PluginType = 'typescript' | 'wasm' | 'hybrid';

export type PluginCategory = 'effect' | 'filter' | 'export' | 'import' | 'ui' | 'tool';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  type: PluginType;
  entry: {
    js?: string;
    wasm?: string;
  };
  permissions: PluginPermission[];
  minAppVersion: string;
  category: PluginCategory;
  settingsSchema?: Record<string, unknown>;
}
