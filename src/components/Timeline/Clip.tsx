import { useTimelineStore, Clip as ClipType } from '../../store/timelineStore';
import { useVideoPreviewStore } from '../../store/videoPreviewStore';
import { useState, useEffect, useRef, useMemo } from 'react';
import { WaveformCanvas } from './WaveformCanvas';
import { useDragClip } from './useDragClip';
import { ClipContextMenu } from './ClipContextMenu';
import { calculateClipPosition, calculateContextMenuTime } from './clipUtils';

interface ClipProps {
  clip: ClipType;
  trackId: string;
  trackType: 'video' | 'audio' | 'text';
}

interface KfDragState {
  originalTime: number;
  startX: number;
  pps: number;
  clipDuration: number;
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

  // --- Keyframe markers ---
  // Collect unique keyframe times across all effect keys
  const keyframeTimes = useMemo(() => {
    if (!clip.keyframes) return [];
    const times = new Set<number>();
    for (const kfs of Object.values(clip.keyframes)) {
      if (kfs && kfs.length >= 2) kfs.forEach(kf => times.add(kf.time));
    }
    return Array.from(times).sort((a, b) => a - b);
  }, [clip.keyframes]);

  const kfDragRef = useRef<KfDragState | null>(null);
  const [kfDragPreview, setKfDragPreview] = useState<{ original: number; current: number } | null>(null);

  useEffect(() => {
    const onMove = (e: globalThis.MouseEvent) => {
      if (!kfDragRef.current) return;
      const { originalTime, startX, pps, clipDuration } = kfDragRef.current;
      const deltaTime = (e.clientX - startX) / pps;
      const newTime = Math.max(0, Math.min(clipDuration, originalTime + deltaTime));
      setKfDragPreview({ original: originalTime, current: newTime });
      // 赤バーを動かさずにプレビューだけ更新
      useVideoPreviewStore.getState().setKfDragPreviewTime(clip.startTime + newTime);
    };

    const onUp = (e: globalThis.MouseEvent) => {
      if (!kfDragRef.current) return;
      const { originalTime, startX, pps, clipDuration } = kfDragRef.current;
      const deltaTime = (e.clientX - startX) / pps;
      const newTime = Math.round(Math.max(0, Math.min(clipDuration, originalTime + deltaTime)) * 100) / 100;
      if (Math.abs(newTime - originalTime) > 0.001) {
        useTimelineStore.getState().moveKeyframes(trackId, clip.id, originalTime, newTime);
      }
      kfDragRef.current = null;
      setKfDragPreview(null);
      useVideoPreviewStore.getState().setKfDragPreviewTime(null);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      // アンマウント時にドラッグ中ならプレビュー状態をクリア
      if (kfDragRef.current) {
        kfDragRef.current = null;
        setKfDragPreview(null);
        useVideoPreviewStore.getState().setKfDragPreviewTime(null);
      }
    };
  }, [trackId, clip.id, clip.startTime]);

  const handleKfMouseDown = (e: React.MouseEvent, time: number) => {
    e.stopPropagation();
    e.preventDefault();
    kfDragRef.current = {
      originalTime: time,
      startX: e.clientX,
      pps: pixelsPerSecond,
      clipDuration: clip.duration,
    };
    setKfDragPreview({ original: time, current: time });
  };

  const handleKfContextMenu = (e: React.MouseEvent, time: number) => {
    e.stopPropagation();
    e.preventDefault();
    useTimelineStore.getState().deleteKeyframesAtTime(trackId, clip.id, time);
  };
  // --- end keyframe markers ---

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (e.button === 0) {
      // 削除ボタン・キーフレームマーカーはドラッグ対象外
      if (target.classList.contains('clip-delete') || target.classList.contains('clip-keyframe-marker')) {
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

        {/* キーフレームマーカー */}
        {keyframeTimes.map(time => {
          const isDraggingThis = kfDragPreview?.original === time;
          const displayTime = isDraggingThis ? kfDragPreview!.current : time;
          const markerLeft = displayTime * pixelsPerSecond;
          return (
            <div
              key={time}
              className={`clip-keyframe-marker${isDraggingThis ? ' dragging' : ''}`}
              style={{ left: `${markerLeft}px` }}
              onMouseDown={(e) => handleKfMouseDown(e, time)}
              onContextMenu={(e) => handleKfContextMenu(e, time)}
              title={`${time.toFixed(2)}s（右クリックで削除）`}
            />
          );
        })}
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
