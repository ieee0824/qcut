import { useTimelineStore } from '../../store/timelineStore';
import { useVideoPreviewStore } from '../../store/videoPreviewStore';
import { useEffect, useRef, useState } from 'react';
import Track from './Track';
import Playhead from './Playhead';
import './Timeline.css';

// タイムコード表示を分離して、currentTime 更新時に Timeline 全体が再レンダーされないようにする
function TimelineTimecode() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const formatTime = (seconds: number): string => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      const frames = Math.floor((seconds % 1) * 30);
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
    };

    // 初期値を設定
    if (ref.current) {
      ref.current.textContent = formatTime(useTimelineStore.getState().currentTime);
    }

    return useTimelineStore.subscribe((state) => {
      if (ref.current) {
        ref.current.textContent = formatTime(state.currentTime);
      }
    });
  }, []);

  return <div className="timeline-timecode" ref={ref} />;
}

function Timeline() {
  const {
    tracks,
    pixelsPerSecond,
    duration,
    zoomIn,
    zoomOut,
    setCurrentTime,
    setSelectedClip,
    deleteSelectedClip,
  } = useTimelineStore();

  const videoPreviewStore = useVideoPreviewStore();
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const trackHeadersRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartX = useRef(0);
  const panStartScrollLeft = useRef(0);

  const timelineWidth = Math.max(3000, duration * pixelsPerSecond);

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelectedClip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelectedClip]);

  // パンニング処理
  useEffect(() => {
    if (!isPanning || !timelineContainerRef.current) return;

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const deltaX = e.clientX - panStartX.current;
      const newScrollLeft = panStartScrollLeft.current - deltaX;
      if (timelineContainerRef.current) {
        timelineContainerRef.current.scrollLeft = newScrollLeft;
      }
    };

    const handleMouseUp = () => {
      setIsPanning(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning]);

  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // ルーラー上でドラッグの場合はパンニング開始
    if ((e.target as HTMLElement).closest('.timeline-ruler')) {
      setIsPanning(true);
      panStartX.current = e.clientX;
      panStartScrollLeft.current = timelineContainerRef.current?.scrollLeft || 0;
    }
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // パンニング中はクリック処理をしない
    if (isPanning) return;

    // クリップ以外の場所をクリックした場合は選択解除
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.timeline-tracks')) {
      setSelectedClip(null, null);
    }
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
    const time = x / pixelsPerSecond;
    setCurrentTime(time);
    videoPreviewStore.setCurrentTime(time);
  };

  const handleTracksScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (trackHeadersRef.current) {
      trackHeadersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  return (
    <div className="timeline">
      <div className="timeline-header">
        <div className="timeline-controls">
          <button onClick={zoomOut} className="timeline-btn">-</button>
          <span className="timeline-zoom">{Math.round(pixelsPerSecond)}px/s</span>
          <button onClick={zoomIn} className="timeline-btn">+</button>
        </div>
        <TimelineTimecode />
      </div>
      
      <div className="timeline-content">
        <div className="timeline-track-headers" ref={trackHeadersRef}>
          <div className="timeline-track-header-spacer" />
          {tracks.map((track) => {
            const primaryClipName = track.clips[0]?.name;
            const displayName = primaryClipName
              ? `${track.name}: ${primaryClipName}`
              : track.name;

            return (
              <div key={track.id} className="timeline-track-header" data-track-type={track.type}>
                <span className="track-name">{displayName}</span>
                <span className="track-type">{track.type}</span>
              </div>
            );
          })}
        </div>
        
        <div 
          className="timeline-tracks-container"
          ref={timelineContainerRef}
          onClick={handleTimelineClick}
          onMouseDown={handleTimelineMouseDown}
          onScroll={handleTracksScroll}
        >
          <div 
            className="timeline-tracks"
            style={{ width: `${timelineWidth}px` }}
          >
            <Playhead />
            
            <div className="timeline-ruler">
              {Array.from({ length: Math.ceil(timelineWidth / pixelsPerSecond) + 1 }).map((_, i) => (
                <div
                  key={i}
                  className="timeline-marker"
                  style={{ left: `${i * pixelsPerSecond}px` }}
                >
                  <span className="timeline-marker-time">{i}s</span>
                </div>
              ))}
            </div>
            
            {tracks.map(track => (
              <Track key={track.id} track={track} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Timeline;
