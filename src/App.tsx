import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { ask } from '@tauri-apps/plugin-dialog';
import './App.css';
import Timeline from './components/Timeline/Timeline';
import { VideoPreview } from './components/VideoPreview/VideoPreview';
import { EffectsPanel } from './components/Inspector/EffectsPanel';
import { TextPanel } from './components/Inspector/TextPanel';
import { FileOperations } from './components/FileOperations/FileOperations';
import { ExportDialog } from './components/Export/ExportDialog';
import { ShortcutHelp } from './components/ShortcutHelp/ShortcutHelp';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTimelineStore } from './store/timelineStore';
import { DEFAULT_TEXT_PROPERTIES } from './store/timelineStore';
import { useVideoPreviewStore } from './store/videoPreviewStore';
import { useExportStore } from './store/exportStore';
import { useShortcutStore } from './store/shortcutStore';
import { useProjectStore } from './store/projectStore';
import { PluginManager } from './plugin-system';
import { PluginSidebarPanels } from './components/Plugin/PluginPanels';
import { PluginToolbarButtons } from './components/Plugin/PluginToolbarButtons';
import { PluginNotifications } from './components/Plugin/PluginNotifications';
import { PluginManagerDialog } from './components/Plugin/PluginManagerDialog';
import { parseSRT, parseASS, subtitlesToTrack, trackToSubtitles, exportSRT, exportASS } from './utils/subtitles';
import { MENU_ACTION } from './menu/menuActions';

function App() {
  const { t, i18n } = useTranslation();
  const { isPlaying, setIsPlaying } = useTimelineStore();
  const videoPreviewStore = useVideoPreviewStore();
  const { setHelpVisible } = useShortcutStore();
  const pluginManagerRef = useRef<PluginManager | null>(null);
  const [isPluginManagerOpen, setIsPluginManagerOpen] = useState(false);

  useKeyboardShortcuts();

  // ウィンドウタイトルをプロジェクト名と未保存状態に連動させる
  const projectName = useProjectStore((s) => s.projectName);
  const isDirty = useProjectStore((s) => s.isDirty);
  useEffect(() => {
    const title = isDirty ? `${projectName}* - qcut` : `${projectName} - qcut`;
    getCurrentWindow().setTitle(title);
  }, [projectName, isDirty]);

  // 未保存変更がある状態でウィンドウを閉じる時に警告、正常終了時に自動保存ファイルを削除
  useEffect(() => {
    const unlisten = getCurrentWindow().onCloseRequested(async (event) => {
      if (useProjectStore.getState().isDirty) {
        event.preventDefault();
        const confirmed = await ask(
          t('project.unsavedCloseConfirm'),
          { title: 'qcut', kind: 'warning' },
        );
        if (confirmed) {
          await useProjectStore.getState().deleteAutosave();
          await getCurrentWindow().destroy();
        }
      } else {
        // 未保存変更がない場合も自動保存ファイルを削除して正常終了
        await useProjectStore.getState().deleteAutosave();
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [t]);

  // 自動保存の開始・停止とクラッシュ復旧チェック
  useEffect(() => {
    const projectStore = useProjectStore.getState();
    projectStore.checkAndRecoverAutosave();
    projectStore.startAutosave();
    projectStore.loadRecentProjects();
    return () => {
      projectStore.stopAutosave();
    };
  }, []);

  useEffect(() => {
    const manager = new PluginManager();
    pluginManagerRef.current = manager;
    manager.initialize().catch((e) => {
      console.warn('[PluginManager] 初期化に失敗:', e);
    });
    return () => {
      manager.shutdown();
    };
  }, []);

  const handleAddTextTrack = useCallback(() => {
    const { addTrack, addClip, tracks } = useTimelineStore.getState();
    const trackId = `track-text-${Date.now()}`;
    addTrack({ id: trackId, type: 'text', name: `Text ${tracks.filter((t) => t.type === 'text').length + 1}`, clips: [] });
    addClip(trackId, {
      id: `text-${Date.now()}`,
      name: 'テキスト',
      startTime: useTimelineStore.getState().currentTime,
      duration: 3,
      color: '#e6a817',
      filePath: '',
      sourceStartTime: 0,
      sourceEndTime: 0,
      textProperties: { ...DEFAULT_TEXT_PROPERTIES },
    });
  }, []);

  const handleAddAudioTrack = useCallback(() => {
    const { addTrack, tracks } = useTimelineStore.getState();
    const audioTracks = tracks.filter((t) => t.type === 'audio');
    const trackId = `audio-${audioTracks.length + 1}`;
    addTrack({ id: trackId, type: 'audio', name: `Audio ${audioTracks.length + 1}`, clips: [] });
  }, []);

  const handleImportSubtitle = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.srt,.ass,.ssa';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const ext = file.name.split('.').pop()?.toLowerCase();
      const entries = ext === 'ass' || ext === 'ssa' ? parseASS(text) : parseSRT(text);
      if (entries.length === 0) return;
      const track = subtitlesToTrack(entries, file.name);
      useTimelineStore.getState().addTrack(track);
    };
    input.click();
  }, []);

  const handleExport = useCallback(async () => {
    try {
      await invoke('check_ffmpeg');
      useExportStore.getState().reset();
      useExportStore.getState().setStatus('configuring');
      useExportStore.getState().setDialogOpen(true);
    } catch (e) {
      window.alert(String(e));
    }
  }, []);

  const handleExportSubtitle = useCallback((format: 'srt' | 'ass') => {
    const { tracks } = useTimelineStore.getState();
    const textTrack = tracks.find((t) => t.type === 'text');
    if (!textTrack) return;
    const entries = trackToSubtitles(textTrack);
    if (entries.length === 0) return;
    const content = format === 'ass' ? exportASS(entries) : exportSRT(entries);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subtitle.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // OS ネイティブメニューバーからのイベントを受け取り、各ハンドラーへ dispatch する
  useEffect(() => {
    const unlisten = listen<string>('menu-event', (event) => {
      const id = event.payload;
      switch (id) {
        case MENU_ACTION.FILE_OPEN_PROJECT:
          useProjectStore.getState().openProject();
          break;
        case MENU_ACTION.FILE_SAVE_PROJECT:
          useProjectStore.getState().saveProject();
          break;
        case MENU_ACTION.FILE_SAVE_PROJECT_AS:
          useProjectStore.getState().saveProjectAs();
          break;
        case MENU_ACTION.FILE_EXPORT_VIDEO:
          handleExport();
          break;
        case MENU_ACTION.FILE_IMPORT_SUBTITLE:
          handleImportSubtitle();
          break;
        case MENU_ACTION.FILE_EXPORT_SRT:
          handleExportSubtitle('srt');
          break;
        case MENU_ACTION.FILE_EXPORT_ASS:
          handleExportSubtitle('ass');
          break;
        case MENU_ACTION.EDIT_UNDO:
          useTimelineStore.getState().undo();
          break;
        case MENU_ACTION.EDIT_REDO:
          useTimelineStore.getState().redo();
          break;
        case MENU_ACTION.EDIT_COPY:
          useTimelineStore.getState().copySelectedClip();
          break;
        case MENU_ACTION.EDIT_PASTE:
          useTimelineStore.getState().pasteClip();
          break;
        case MENU_ACTION.TIMELINE_ADD_AUDIO_TRACK:
          handleAddAudioTrack();
          break;
        case MENU_ACTION.TIMELINE_ADD_TEXT_TRACK:
          handleAddTextTrack();
          break;
        case MENU_ACTION.VIEW_LANGUAGE_JA:
          i18n.changeLanguage('ja');
          localStorage.setItem('i18n-language', 'ja');
          break;
        case MENU_ACTION.VIEW_LANGUAGE_EN:
          i18n.changeLanguage('en');
          localStorage.setItem('i18n-language', 'en');
          break;
        case MENU_ACTION.PLUGINS_MANAGER:
          setIsPluginManagerOpen(true);
          break;
        case MENU_ACTION.HELP_SHORTCUTS:
          setHelpVisible(true);
          break;
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePlay = () => {
    const newPlayingState = !isPlaying;
    setIsPlaying(newPlayingState);
    videoPreviewStore.setIsPlaying(newPlayingState);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>{t('app.title')}</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <FileOperations />
          <button onClick={handleAddAudioTrack} className="play-btn" title={t('timeline.addAudioTrack')}>
            ♪+
          </button>
          <button onClick={handleAddTextTrack} className="play-btn" title={t('text.addTextTrack')}>
            T+
          </button>
          <button onClick={togglePlay} className="play-btn">
            {isPlaying ? t('button.pause') : t('button.play')}
          </button>
          <PluginToolbarButtons />
          <button onClick={() => setHelpVisible(true)} className="play-btn" title={t('shortcut.title')}>
            ?
          </button>
        </div>
      </header>
      <main className="app-main">
        <div className="preview-container">
          <VideoPreview />
          <EffectsPanel />
          <TextPanel />
          <PluginSidebarPanels />
        </div>
        <div className="timeline-container">
          <Timeline />
        </div>
      </main>
      <ExportDialog />
      <ShortcutHelp />
      <PluginNotifications />
      {isPluginManagerOpen && pluginManagerRef.current && (
        <PluginManagerDialog
          manager={pluginManagerRef.current}
          onClose={() => setIsPluginManagerOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
