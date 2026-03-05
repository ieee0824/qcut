import { useTimelineStore, Clip as ClipType } from '../../store/timelineStore';
import { useVideoPreviewStore } from '../../store/videoPreviewStore';
import { useTransitionPresetStore } from '../../store/transitionPresetStore';
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface ClipProps {
  clip: ClipType;
  trackId: string;
}

function Clip({ clip, trackId }: ClipProps) {
  const { t } = useTranslation();
  const {
    pixelsPerSecond,
    removeClip,
    setSelectedClip,
    selectedClipId,
    splitClipAtTime,
    updateClip,
    setTransition,
    removeTransition,
  } = useTimelineStore();
  const allPresets = useTransitionPresetStore((s) => s.getAllPresets)();
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showTransitionSubmenu, setShowTransitionSubmenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const dragStartX = useRef(0);
  const dragStartTime = useRef(0);

  const left = clip.startTime * pixelsPerSecond;
  const width = clip.duration * pixelsPerSecond;
  const isSelected = selectedClipId === clip.id;

  const hasTransition = !!clip.transition;

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('clip-resize-handle')) {
      setIsResizing(true);
    } else {
      setIsDragging(true);
      dragStartX.current = e.clientX;
      dragStartTime.current = clip.startTime;
    }
    // クリップを選択
    setSelectedClip(trackId, clip.id);
    e.stopPropagation();
  };

  // ドラッグ処理
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const deltaX = e.clientX - dragStartX.current;
      const deltaTime = deltaX / pixelsPerSecond;
      let newStartTime = dragStartTime.current + deltaTime;
      
      // 負の値にならないようにする
      newStartTime = Math.max(0, newStartTime);
      
      updateClip(trackId, clip.id, { startTime: newStartTime });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, pixelsPerSecond, trackId, clip.id, updateClip]);

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
                  <div className="context-submenu">
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
