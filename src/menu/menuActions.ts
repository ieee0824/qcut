export const MENU_ACTION = {
  FILE_OPEN_PROJECT:    'file.openProject',
  FILE_SAVE_PROJECT:    'file.saveProject',
  FILE_SAVE_PROJECT_AS: 'file.saveProjectAs',
  FILE_EXPORT_VIDEO:    'file.exportVideo',
  FILE_IMPORT_SUBTITLE: 'file.importSubtitle',
  FILE_EXPORT_SRT:      'file.exportSRT',
  FILE_EXPORT_ASS:      'file.exportASS',

  EDIT_UNDO:  'edit.undo',
  EDIT_REDO:  'edit.redo',
  EDIT_COPY:  'edit.copy',
  EDIT_PASTE: 'edit.paste',

  TIMELINE_ADD_AUDIO_TRACK: 'timeline.addAudioTrack',
  TIMELINE_ADD_TEXT_TRACK:  'timeline.addTextTrack',

  VIEW_LANGUAGE_JA: 'view.languageJa',
  VIEW_LANGUAGE_EN: 'view.languageEn',

  PLUGINS_MANAGER: 'plugins.manager',
  HELP_SHORTCUTS:  'help.shortcuts',
} as const;

export type MenuActionId = typeof MENU_ACTION[keyof typeof MENU_ACTION];
