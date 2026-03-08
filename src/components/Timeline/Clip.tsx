import { useTimelineStore, Clip as ClipType } from '../../store/timelineStore';
import { useVideoPreviewStore } from '../../store/videoPreviewStore';
import { useTransitionPresetStore } from '../../store/transitionPresetStore';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { WaveformCanvas } from './WaveformCanvas';

interface ClipProps {
  clip: ClipType;
  trackId: string;
  trackType: 'video' | 'audio' | 'text';
}

function Clip({ clip, trackId, trackType }: ClipProps) {
  const { t } = useTranslation();
  const {
    pixelsPerSecond,
    removeClip,
    setSelectedClip,
    selectedClipId,
    splitClipAtTime,
    updateClipSilent,
    commitHistory,
    setTransition,
    removeTransition,
    moveClipToTrack,
    addTrack,
    addClip,
    updateClip,
  } = useTimelineStore();
  const [isExtracting, setIsExtracting] = useState(false);
  const allPresets = useTransitionPresetStore((s) => s.getAllPresets)();
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showTransitionSubmenu, setShowTransitionSubmenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartTime = useRef(0);

  const left = clip.startTime * pixelsPerSecond;
  const width = clip.duration * pixelsPerSecond;
  const isSelected = selectedClipId === clip.id;

  const hasTransition = !!clip.transition;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      // 左クリックのみドラッグ/リサイズを開始
      if ((e.target as HTMLElement).classList.contains('clip-resize-handle')) {
        setIsResizing(true);
      } else {
        setIsDragging(true);
        dragStartX.current = e.clientX;
        dragStartTime.current = clip.startTime;
      }
    }
    // クリップを選択
    setSelectedClip(trackId, clip.id);
    e.stopPropagation();
  };

  // ドラッグ処理
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
      updateClipSilent(currentTrackId, clip.id, { startTime: newStartTime });

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
        moveClipToTrack(currentTrackId, clip.id, targetTrackId);
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
  }, [isDragging, pixelsPerSecond, trackId, clip.id, updateClipSilent, commitHistory, moveClipToTrack]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 右クリック位置にプレイヘッドを移動
    const clipEl = (e.currentTarget as HTMLElement).closest('.timeline-clip');
    if (clipEl) {
      const rect = clipEl.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relTime = relX / pixelsPerSecond;
      const time = clip.startTime + Math.max(0, Math.min(relTime, clip.duration));
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

  const handleSplit = (e: React.MouseEvent) => {
    e.stopPropagation();
    splitClipAtTime(trackId, clip.id, useTimelineStore.getState().currentTime);
    setShowContextMenu(false);
  };

  const handleRemoveTransition = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeTransition(trackId, clip.id);
    setShowContextMenu(false);
  };

  // コンテキストメニューが画面外にはみ出る場合、位置を自動補正
  useEffect(() => {
    if (!showContextMenu || !contextMenuRef.current) return;
    const menu = contextMenuRef.current;
    const rect = menu.getBoundingClientRect();
    let { x, y } = contextMenuPos;
    if (rect.right > window.innerWidth) {
      x = window.innerWidth - rect.width;
    }
    if (rect.bottom > window.innerHeight) {
      y = window.innerHeight - rect.height;
    }
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x !== contextMenuPos.x || y !== contextMenuPos.y) {
      setContextMenuPos({ x, y });
    }
  }, [showContextMenu, contextMenuPos]);

  // サブメニューが画面外にはみ出る場合、位置を自動補正
  useEffect(() => {
    if (!showTransitionSubmenu || !submenuRef.current) return;
    const submenu = submenuRef.current;
    const rect = submenu.getBoundingClientRect();
    if (rect.bottom > window.innerHeight) {
      submenu.style.top = 'auto';
      submenu.style.bottom = '0';
    } else {
      submenu.style.top = '0';
      submenu.style.bottom = 'auto';
    }
    if (rect.right > window.innerWidth) {
      submenu.style.left = 'auto';
      submenu.style.right = '100%';
    } else {
      submenu.style.left = '100%';
      submenu.style.right = 'auto';
    }
  }, [showTransitionSubmenu]);

  const handleExtractAudio = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowContextMenu(false);
    if (!clip.filePath || isExtracting) return;

    setIsExtracting(true);
    try {
      const audioPath = await invoke<string>('extract_audio', { filePath: clip.filePath });

      // 音声の長さを取得
      const audio = new window.Audio();
      const duration = await new Promise<number>((resolve, reject) => {
        audio.onloadedmetadata = () => resolve(audio.duration);
        audio.onerror = () => reject(new Error('音声ファイルの読み込みに失敗'));
        audio.src = `asset://localhost/${encodeURIComponent(audioPath)}`;
      });

      // 音声トラックを作成
      const audioTrackId = `track-audio-${Date.now()}`;
      addTrack({ id: audioTrackId, type: 'audio', name: `${clip.name} (音声)`, clips: [] });

      // 音声クリップを追加（元のビデオクリップと同じ位置・範囲）
      addClip(audioTrackId, {
        id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: `${clip.name} (音声)`,
        startTime: clip.startTime,
        duration: clip.duration,
        filePath: audioPath,
        sourceStartTime: clip.sourceStartTime,
        sourceEndTime: Math.min(clip.sourceEndTime, duration),
        color: '#6ecf6e',
      });

      // 元のビデオクリップをミュート
      updateClip(trackId, clip.id, {
        effects: { ...(clip.effects || {} as ClipType['effects']), volume: 0 } as ClipType['effects'],
      });
    } catch (err) {
      console.error('音声分離に失敗:', err);
    } finally {
      setIsExtracting(false);
    }
  }, [clip, trackId, isExtracting, addTrack, addClip, updateClip]);

  const handleCloseContextMenu = () => {
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
        <>
          <div className="context-menu-overlay" onClick={handleCloseContextMenu} />
          <div
            ref={contextMenuRef}
            className="context-menu"
            style={{
              left: `${contextMenuPos.x}px`,
              top: `${contextMenuPos.y}px`,
            }}
          >
            <button className="context-menu-item" onClick={handleSplit}>
              ✂️ 分割
            </button>
            {!hasTransition && (
              <div
                className="context-menu-item context-menu-submenu-trigger"
                onMouseEnter={() => setShowTransitionSubmenu(true)}
                onMouseLeave={() => setShowTransitionSubmenu(false)}
              >
                🔄 {t('transition.add')} ▸
                {showTransitionSubmenu && (
                  <div ref={submenuRef} className="context-submenu">
                    {allPresets.map(preset => (
                      <button
                        key={preset.id}
                        className="context-menu-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTransition(trackId, clip.id, { type: preset.type, duration: preset.duration });
                          setShowContextMenu(false);
                        }}
                      >
                        {preset.isBuiltIn ? t(preset.name) : preset.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {hasTransition && (
              <button className="context-menu-item" onClick={handleRemoveTransition}>
                🔄 {t('transition.remove')}
              </button>
            )}
            {trackType === 'video' && clip.filePath && (
              <button
                className="context-menu-item"
                onClick={handleExtractAudio}
                disabled={isExtracting}
              >
                🔊 {isExtracting ? '音声分離中...' : '音声を分離'}
              </button>
            )}
            <button className="context-menu-item" onClick={handleDelete}>
              🗑️ 削除
            </button>
          </div>
        </>
      )}
    </>
  );
}

export default Clip;
