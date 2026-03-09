import { useState, useRef, useEffect } from 'react';
import { useTimelineStore } from '../../store/timelineStore';

interface UseDragClipParams {
  clipId: string;
  trackId: string;
  startTime: number;
  pixelsPerSecond: number;
}

export function useDragClip({ clipId, trackId, startTime, pixelsPerSecond }: UseDragClipParams) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartTime = useRef(0);

  const {
    updateClipSilent,
    commitHistory,
    moveClipToTrack,
  } = useTimelineStore();

  const startDrag = (clientX: number) => {
    setIsDragging(true);
    dragStartX.current = clientX;
    dragStartTime.current = startTime;
  };

  useEffect(() => {
    if (!isDragging) return;

    // ドラッグ中のトラックハイライト用: 現在のtrackIdを追跡
    let currentTrackId = trackId;

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      // 水平方向の移動
      const deltaX = e.clientX - dragStartX.current;
      const deltaTime = deltaX / pixelsPerSecond;
      let newStartTime = dragStartTime.current + deltaTime;
      newStartTime = Math.max(0, newStartTime);
      updateClipSilent(currentTrackId, clipId, { startTime: newStartTime });

      // 垂直方向: ドロップ先トラックの判定
      const trackEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('.timeline-track') as HTMLElement | null;
      const targetTrackId = trackEl?.dataset.trackId;

      // ハイライト更新
      document.querySelectorAll('.timeline-track.drop-target').forEach(el => el.classList.remove('drop-target'));
      if (targetTrackId && targetTrackId !== currentTrackId) {
        trackEl?.classList.add('drop-target');
      }

      // トラック移動
      if (targetTrackId && targetTrackId !== currentTrackId) {
        moveClipToTrack(currentTrackId, clipId, targetTrackId);
        currentTrackId = targetTrackId;
      }
    };

    const handleMouseUp = () => {
      document.querySelectorAll('.timeline-track.drop-target').forEach(el => el.classList.remove('drop-target'));
      commitHistory();
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, pixelsPerSecond, trackId, clipId, updateClipSilent, commitHistory, moveClipToTrack]);

  return { isDragging, startDrag };
}
