import { useEffect } from 'react';
import './App.css';
import Timeline from './components/Timeline/Timeline';
import { VideoPreview } from './components/VideoPreview/VideoPreview';
import { FileOperations } from './components/FileOperations/FileOperations';
import { useTimelineStore } from './store/timelineStore';

function App() {
  const { addClip, isPlaying, setIsPlaying } = useTimelineStore();

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
        <h1>qcut - Video Editor</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <FileOperations />
          <button onClick={togglePlay} className="play-btn">
            {isPlaying ? '⏸' : '▶'}
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
