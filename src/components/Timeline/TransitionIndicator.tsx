import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTimelineStore, type Clip, type TimelineTransition } from '../../store/timelineStore';
import { TransitionPopover } from './TransitionPopover';
import { TransitionMenu } from './TransitionMenu';
import { computeIndicatorLayout } from './transitionLayout';
import { TRANSITION_I18N_KEYS } from './transitionConstants';

interface TransitionIndicatorProps {
  transition: TimelineTransition;
  incomingClip: Pick<Clip, 'id' | 'startTime'>;
}

function TransitionIndicator({ transition, incomingClip }: TransitionIndicatorProps) {
  const { t } = useTranslation();
  const { pixelsPerSecond, removeTransitionById } = useTimelineStore();
  const [showPopover, setShowPopover] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const indicatorRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });

  const { width, left } = computeIndicatorLayout(transition, pixelsPerSecond, incomingClip);

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
    removeTransitionById(transition.id);
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
