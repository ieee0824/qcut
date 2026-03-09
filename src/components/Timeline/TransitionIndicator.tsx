import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTimelineStore, type ClipTransition, type TransitionType } from '../../store/timelineStore';
import { TransitionPopover } from './TransitionPopover';
import { TransitionMenu } from './TransitionMenu';

interface TransitionIndicatorProps {
  transition: ClipTransition;
  clipId: string;
  trackId: string;
  clipStartTime: number;
}

const TRANSITION_I18N_KEYS: Record<TransitionType, string> = {
  'crossfade': 'transition.crossfade',
  'dissolve': 'transition.dissolve',
  'wipe-left': 'transition.wipeLeft',
  'wipe-right': 'transition.wipeRight',
  'wipe-up': 'transition.wipeUp',
  'wipe-down': 'transition.wipeDown',
};

function TransitionIndicator({ transition, clipId, trackId, clipStartTime }: TransitionIndicatorProps) {
  const { t } = useTranslation();
  const { pixelsPerSecond, removeTransition } = useTimelineStore();
  const [showPopover, setShowPopover] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const indicatorRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });

  const width = transition.duration * pixelsPerSecond;
  const left = clipStartTime * pixelsPerSecond - width / 2;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!showPopover && indicatorRef.current) {
      const rect = indicatorRef.current.getBoundingClientRect();
      setPopoverPos({ x: rect.left, y: rect.bottom + 4 });
    }
    setShowPopover(!showPopover);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleRemove = () => {
    removeTransition(trackId, clipId);
    setShowContextMenu(false);
  };

  return (
    <>
      <div
        ref={indicatorRef}
        className="transition-indicator"
        style={{ left: `${left}px`, width: `${width}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        title={t(TRANSITION_I18N_KEYS[transition.type])}
      >
        <span className="transition-icon">◆</span>
        <span className="transition-label">
          {t(TRANSITION_I18N_KEYS[transition.type])}
        </span>
      </div>

      {showPopover && (
        <TransitionPopover
          transition={transition}
          clipId={clipId}
          trackId={trackId}
          popoverPos={popoverPos}
          indicatorRef={indicatorRef}
          onClose={() => setShowPopover(false)}
        />
      )}

      {showContextMenu && (
        <TransitionMenu
          contextMenuPos={contextMenuPos}
          onRemove={handleRemove}
          onClose={() => setShowContextMenu(false)}
        />
      )}
    </>
  );
}

export default TransitionIndicator;
