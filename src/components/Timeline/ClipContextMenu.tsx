import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTimelineStore, Clip as ClipType, DEFAULT_EFFECTS, type TimelineTransition, type TransitionType } from '../../store/timelineStore';
import { TransitionSubmenu } from './TransitionSubmenu';
import { clampMenuPosition } from './clipUtils';

interface ClipContextMenuProps {
  clip: ClipType;
  trackId: string;
  trackType: 'video' | 'audio' | 'text';
  position: { x: number; y: number };
  onClose: () => void;
}

export function ClipContextMenu({ clip, trackId, trackType, position, onClose }: ClipContextMenuProps) {
  const { t } = useTranslation();
  const {
    removeClip,
    splitClipAtTime,
    addTransition,
    removeTransitionById,
    addTrack,
    addClip,
    updateClip,
  } = useTimelineStore();

  const [menuPos, setMenuPos] = useState(position);
  const [visible, setVisible] = useState(false);
  const [showTransitionSubmenu, setShowTransitionSubmenu] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const incomingTransition = useTimelineStore((state) =>
    state.transitions.find((transition) => transition.inClipId === clip.id && transition.inTrackId === trackId),
  );
  const hasTransition = !!incomingTransition;

  const findPreviousClip = (): ClipType | null => {
    const track = useTimelineStore.getState().tracks.find((candidate) => candidate.id === trackId);
    if (!track) return null;
    const sortedClips = [...track.clips].sort((a, b) => a.startTime - b.startTime);
    const currentIndex = sortedClips.findIndex((candidate) => candidate.id === clip.id);
    if (currentIndex <= 0) return null;
    return sortedClips[currentIndex - 1];
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeClip(trackId, clip.id);
    onClose();
  };

  const handleSplit = (e: React.MouseEvent) => {
    e.stopPropagation();
    splitClipAtTime(trackId, clip.id, useTimelineStore.getState().currentTime);
    onClose();
  };

  const handleRemoveTransition = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (incomingTransition) {
      removeTransitionById(incomingTransition.id);
    }
    onClose();
  };

  const handleExtractAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
    if (!clip.filePath) return;

    // 音声トラックを作成し、同じ動画ファイルを参照する音声クリップを配置
    const audioTrackId = `track-audio-${Date.now()}`;
    addTrack({ id: audioTrackId, type: 'audio', name: `${clip.name} (音声)`, clips: [] });

    addClip(audioTrackId, {
      id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: `${clip.name} (音声)`,
      startTime: clip.startTime,
      duration: clip.duration,
      filePath: clip.filePath,
      sourceStartTime: clip.sourceStartTime,
      sourceEndTime: clip.sourceEndTime,
      color: '#6ecf6e',
    });

    // 元のビデオクリップをミュート
    updateClip(trackId, clip.id, {
      effects: { ...DEFAULT_EFFECTS, ...clip.effects, volume: 0 },
    });
  };

  const handleSelectTransition = (presetType: TransitionType, presetDuration: number) => {
    const previousClip = findPreviousClip();
    if (!previousClip) {
      onClose();
      return;
    }

    const transition: TimelineTransition = incomingTransition ?? {
      id: `transition-${previousClip.id}-${clip.id}`,
      type: presetType,
      duration: presetDuration,
      outTrackId: trackId,
      outClipId: previousClip.id,
      inTrackId: trackId,
      inClipId: clip.id,
    };

    if (incomingTransition) {
      useTimelineStore.getState().updateTransition(incomingTransition.id, {
        type: presetType,
        duration: presetDuration,
      });
    } else {
      addTransition(transition);
    }
    onClose();
  };

  // コンテキストメニューが画面外にはみ出る場合、位置を自動補正
  useEffect(() => {
    if (!contextMenuRef.current) return;
    const menu = contextMenuRef.current;
    const rect = menu.getBoundingClientRect();
    const clamped = clampMenuPosition(
      position,
      rect.width,
      rect.height,
      window.innerWidth,
      window.innerHeight,
    );
    setMenuPos(clamped);
    setVisible(true);
  }, [position]);

  return (
    <>
      <div className="context-menu-overlay" onClick={onClose} />
      <div
        ref={contextMenuRef}
        className="context-menu"
        style={{
          left: `${menuPos.x}px`,
          top: `${menuPos.y}px`,
          visibility: visible ? 'visible' : 'hidden',
        }}
      >
        <button className="context-menu-item" onClick={handleSplit}>
          ✂️ 分割
        </button>
        {!hasTransition && (
          <div
            className="context-menu-item context-menu-submenu-trigger"
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={showTransitionSubmenu}
            tabIndex={0}
            onMouseEnter={() => setShowTransitionSubmenu(true)}
            onMouseLeave={() => setShowTransitionSubmenu(false)}
            onFocus={() => setShowTransitionSubmenu(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) {
                setShowTransitionSubmenu(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
                e.preventDefault();
                setShowTransitionSubmenu(true);
              } else if (e.key === 'Escape' || e.key === 'ArrowLeft') {
                setShowTransitionSubmenu(false);
              }
            }}
          >
            🔄 {t('transition.add')} ▸
            {showTransitionSubmenu && (
              <TransitionSubmenu onSelectTransition={handleSelectTransition} />
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
          >
            🔊 音声を分離
          </button>
        )}
        <button className="context-menu-item" onClick={handleDelete}>
          🗑️ 削除
        </button>
      </div>
    </>
  );
}
