import { useTimelineStore, Clip as ClipType } from '../../store/timelineStore';
import { useState } from 'react';

interface ClipProps {
  clip: ClipType;
  trackId: string;
}

function Clip({ clip, trackId }: ClipProps) {
  const { pixelsPerSecond, removeClip } = useTimelineStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const left = clip.startTime * pixelsPerSecond;
  const width = clip.duration * pixelsPerSecond;

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('clip-resize-handle')) {
      setIsResizing(true);
    } else {
      setIsDragging(true);
    }
    e.stopPropagation();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeClip(trackId, clip.id);
  };

  return (
    <div
      className={`timeline-clip ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''}`}
      style={{
        left: `${left}px`,
        width: `${width}px`,
        backgroundColor: clip.color || '#4a9eff',
      }}
      onMouseDown={handleMouseDown}
      title={clip.name}
    >
      <div className="clip-content">
        <span className="clip-name">{clip.name}</span>
        <button className="clip-delete" onClick={handleDelete}>×</button>
      </div>
      <div className="clip-resize-handle clip-resize-left"></div>
      <div className="clip-resize-handle clip-resize-right"></div>
    </div>
  );
}

export default Clip;
