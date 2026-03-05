import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './App.css';
import Timeline from './components/Timeline/Timeline';
import { VideoPreview } from './components/VideoPreview/VideoPreview';
import { EffectsPanel } from './components/Inspector/EffectsPanel';
import { TextPanel } from './components/Inspector/TextPanel';
import { FileOperations } from './components/FileOperations/FileOperations';
import { useTimelineStore } from './store/timelineStore';
import { DEFAULT_TEXT_PROPERTIES } from './store/timelineStore';
import { useVideoPreviewStore } from './store/videoPreviewStore';
import { PluginManager } from './plugin-system';
import { parseSRT, parseASS, subtitlesToTrack, trackToSubtitles, exportSRT, exportASS } from './utils/subtitles';

function App() {
  const { t, i18n } = useTranslation();
  const { isPlaying, setIsPlaying } = useTimelineStore();
  const videoPreviewStore = useVideoPreviewStore();
  const pluginManagerRef = useRef<PluginManager | null>(null);

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
          <button onClick={togglePlay} className="play-btn">
            {isPlaying ? t('button.pause') : t('button.play')}
          </button>
        </div>
      </header>
      <main className="app-main">
        <div className="preview-container">
          <VideoPreview />
          <EffectsPanel />
          <TextPanel />
        </div>
        <div className="timeline-container">
          <Timeline />
        </div>
      </main>
    </div>
  );
}

export default App;
