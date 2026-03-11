import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
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

function App() {
  const { t, i18n } = useTranslation();
  const { isPlaying, setIsPlaying } = useTimelineStore();
  const videoPreviewStore = useVideoPreviewStore();
  const { setDialogOpen: setExportDialogOpen, setStatus: setExportStatus } = useExportStore();
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

  // 言語切り替え
  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('i18n-language', lang);
  };

  const togglePlay = () => {
    const newPlayingState = !isPlaying;
    setIsPlaying(newPlayingState);
    videoPreviewStore.setIsPlaying(newPlayingState);
  };

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
      setExportStatus('configuring');
      setExportDialogOpen(true);
    } catch (e) {
      window.alert(String(e));
    }
  }, [setExportStatus, setExportDialogOpen]);

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

  return (
    <div className="app">
      <header className="app-header">
        <h1>{t('app.title')}</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* 言語切り替えボタン */}
          <div style={{ display: 'flex', gap: '0.3rem', borderRadius: '4px', border: '1px solid #ccc', padding: '0.2rem' }}>
            <button
              onClick={() => handleLanguageChange('ja')}
              style={{
                padding: '0.4rem 0.8rem',
                backgroundColor: i18n.language === 'ja' ? '#4a9eff' : 'transparent',
                color: i18n.language === 'ja' ? '#fff' : '#ccc',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: i18n.language === 'ja' ? 'bold' : 'normal',
              }}
            >
              日本語
            </button>
            <button
              onClick={() => handleLanguageChange('en')}
              style={{
                padding: '0.4rem 0.8rem',
                backgroundColor: i18n.language === 'en' ? '#4a9eff' : 'transparent',
                color: i18n.language === 'en' ? '#fff' : '#ccc',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: i18n.language === 'en' ? 'bold' : 'normal',
              }}
            >
              English
            </button>
          </div>
          <FileOperations />
          <button onClick={handleAddAudioTrack} className="play-btn" title={t('timeline.addAudioTrack')}>
            ♪+
          </button>
          <button onClick={handleAddTextTrack} className="play-btn" title={t('text.addTextTrack')}>
            T+
          </button>
          <button onClick={handleImportSubtitle} className="play-btn" title={t('text.importSubtitle')}>
            {t('text.importSubtitle')}
          </button>
          <button onClick={() => handleExportSubtitle('srt')} className="play-btn" title={t('text.exportSubtitle')}>
            SRT
          </button>
          <button onClick={() => handleExportSubtitle('ass')} className="play-btn" title={t('text.exportSubtitle')}>
            ASS
          </button>
          <button onClick={handleExport} className="play-btn" title={t('export.title')}>
            {t('export.button')}
          </button>
          <button onClick={togglePlay} className="play-btn">
            {isPlaying ? t('button.pause') : t('button.play')}
          </button>
          <PluginToolbarButtons />
          <button onClick={() => setIsPluginManagerOpen(true)} className="play-btn" title={t('plugin.managerTitle')}>
            {t('plugin.managerButton')}
          </button>
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
