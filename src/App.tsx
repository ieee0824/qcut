import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './App.css';
import Timeline from './components/Timeline/Timeline';
import { VideoPreview } from './components/VideoPreview/VideoPreview';
import { FileOperations } from './components/FileOperations/FileOperations';
import { useTimelineStore } from './store/timelineStore';

function App() {
  const { t, i18n } = useTranslation();
  const { addClip, isPlaying, setIsPlaying } = useTimelineStore();

  // 言語切り替え
  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('i18n-language', lang);
  };

  // デモ用のクリップを追加
  useEffect(() => {
    // 初期クリップを追加
    addClip('video-1', {
      id: 'clip-1',
      name: 'Video Clip 1',
      startTime: 0,
      duration: 5,
      color: '#4a9eff',
    });
    addClip('video-1', {
      id: 'clip-2',
      name: 'Video Clip 2',
      startTime: 6,
      duration: 4,
      color: '#ff6b6b',
    });
    addClip('audio-1', {
      id: 'clip-3',
      name: 'Audio Track',
      startTime: 0,
      duration: 10,
      color: '#51cf66',
    });
  }, [addClip]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

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
          <button onClick={togglePlay} className="play-btn">
            {isPlaying ? t('button.pause') : t('button.play')}
          </button>
        </div>
      </header>
      <main className="app-main">
        <div className="preview-container">
          <VideoPreview />
        </div>
        <div className="timeline-container">
          <Timeline />
        </div>
      </main>
    </div>
  );
}

export default App;
