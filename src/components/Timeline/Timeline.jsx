import { useTimelineStore } from '../../store/timelineStore';
import Track from './Track';
import Playhead from './Playhead';
import './Timeline.css';

function Timeline() {
  const {
    tracks,
    pixelsPerSecond,
    currentTime,
    duration,
    zoomIn,
    zoomOut,
    setCurrentTime,
  } = useTimelineStore();

  const timelineWidth = Math.max(3000, duration * pixelsPerSecond);

  const handleTimelineClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
    const time = x / pixelsPerSecond;
    setCurrentTime(time);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };

  return (
    <div className="timeline">
      <div className="timeline-header">
        <div className="timeline-controls">
          <button onClick={zoomOut} className="timeline-btn">-</button>
          <span className="timeline-zoom">{Math.round(pixelsPerSecond)}px/s</span>
          <button onClick={zoomIn} className="timeline-btn">+</button>
        </div>
        <div className="timeline-timecode">
          {formatTime(currentTime)}
        </div>
      </div>
      
      <div className="timeline-content">
        <div className="timeline-track-headers">
          {tracks.map(track => (
            <div key={track.id} className="timeline-track-header">
              <span className="track-name">{track.name}</span>
              <span className="track-type">{track.type}</span>
            </div>
          ))}
        </div>
        
        <div 
          className="timeline-tracks-container"
          onClick={handleTimelineClick}
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
