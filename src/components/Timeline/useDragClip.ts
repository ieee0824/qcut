import { useState, useRef, useEffect } from 'react';
import { useTimelineStore } from '../../store/timelineStore';
import { calculateDragNewStartTime, collectSnapTargets, applySnap } from './clipUtils';

const SNAP_THRESHOLD_PX = 10;

interface UseDragClipParams {
  clipId: string;
  trackId: string;
  startTime: number;
  duration: number;
  pixelsPerSecond: number;
}

export function useDragClip({ clipId, trackId, startTime, duration, pixelsPerSecond }: UseDragClipParams) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartTime = useRef(0);
  const committedRef = useRef(false);

  const {
    updateClipSilent,
    commitHistory,
    moveClipToTrack,
    setSnapLineTime,
  } = useTimelineStore();

  const startDrag = (clientX: number) => {
    committedRef.current = false;
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
      let newStartTime = calculateDragNewStartTime(dragStartTime.current, deltaX, pixelsPerSecond);

      // スナップ適用
      const state = useTimelineStore.getState();
      if (state.snapEnabled) {
        const allClips = state.tracks.flatMap(t => t.clips);
        const targets = collectSnapTargets(allClips, clipId, state.currentTime);
        const threshold = SNAP_THRESHOLD_PX / pixelsPerSecond;
        const snap = applySnap(newStartTime, duration, targets, threshold);
        newStartTime = snap.startTime;
        setSnapLineTime(snap.snapLine);
      } else {
        setSnapLineTime(null);
      }

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
      setSnapLineTime(null);
      committedRef.current = true;
      commitHistory();
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      // アンマウント等でmouseupが発火しなかった場合のフォールバック
      document.querySelectorAll('.timeline-track.drop-target').forEach(el => el.classList.remove('drop-target'));
      setSnapLineTime(null);
      if (!committedRef.current) {
        commitHistory();
      }
    };
  }, [isDragging, pixelsPerSecond, duration, trackId, clipId, updateClipSilent, commitHistory, moveClipToTrack, setSnapLineTime]);

  return { isDragging, startDrag };
}
