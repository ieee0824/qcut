import { useTimelineStore, Clip as ClipType } from '../../store/timelineStore';
import { useVideoPreviewStore } from '../../store/videoPreviewStore';
import { useState } from 'react';
import { WaveformCanvas } from './WaveformCanvas';
import { useDragClip } from './useDragClip';
import { ClipContextMenu } from './ClipContextMenu';
import { calculateClipPosition, calculateContextMenuTime } from './clipUtils';

interface ClipProps {
  clip: ClipType;
  trackId: string;
  trackType: 'video' | 'audio' | 'text';
}

function Clip({ clip, trackId, trackType }: ClipProps) {
  const {
    pixelsPerSecond,
    removeClip,
    setSelectedClip,
    selectedClipId,
  } = useTimelineStore();

  const [isResizing, setIsResizing] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

  const { isDragging, startDrag } = useDragClip({
    clipId: clip.id,
    trackId,
    startTime: clip.startTime,
    pixelsPerSecond,
  });

  const { left, width } = calculateClipPosition(clip.startTime, clip.duration, pixelsPerSecond);
  const isSelected = selectedClipId === clip.id;

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (e.button === 0) {
      // 削除ボタンはドラッグ対象外
      if (target.classList.contains('clip-delete')) {
        setSelectedClip(trackId, clip.id);
        return;
      }
      // 左クリックのみドラッグ/リサイズを開始
      if (target.classList.contains('clip-resize-handle')) {
        setIsResizing(true);
      } else {
        startDrag(e.clientX);
      }
    }
    // クリップを選択
    setSelectedClip(trackId, clip.id);
    e.stopPropagation();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 右クリック位置にプレイヘッドを移動
    const clipEl = (e.currentTarget as HTMLElement).closest('.timeline-clip');
    if (clipEl) {
      const rect = clipEl.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const time = calculateContextMenuTime(clip.startTime, clip.duration, relX, pixelsPerSecond);
      useTimelineStore.getState().setCurrentTime(time);
      useVideoPreviewStore.getState().setCurrentTime(time);
    }

    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
    setSelectedClip(trackId, clip.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeClip(trackId, clip.id);
    setShowContextMenu(false);
  };

  return (
    <>
      <div
        className={`timeline-clip ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''} ${isSelected ? 'selected' : ''}`}
        style={{
          left: `${left}px`,
          width: `${width}px`,
          backgroundColor: clip.color || '#4a9eff',
        }}
        onMouseDown={handleMouseDown}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={handleContextMenu}
        title={clip.name}
      >
        {clip.filePath && trackType !== 'text' && (
          <WaveformCanvas
            filePath={clip.filePath}
            sourceStartTime={clip.sourceStartTime}
            sourceEndTime={clip.sourceEndTime}
            width={width}
            height={48}
            color={trackType === 'audio' ? '#a0cfff' : 'rgba(160, 207, 255, 0.4)'}
          />
        )}
        <div className="clip-content">
          <span className="clip-name">{clip.name}</span>
          <button className="clip-delete" onClick={handleDelete}>×</button>
        </div>
        <div className="clip-resize-handle clip-resize-left"></div>
        <div className="clip-resize-handle clip-resize-right"></div>
      </div>

      {showContextMenu && (
        <ClipContextMenu
          clip={clip}
          trackId={trackId}
          trackType={trackType}
          position={contextMenuPos}
          onClose={() => setShowContextMenu(false)}
        />
      )}
    </>
  );
}

export default Clip;
