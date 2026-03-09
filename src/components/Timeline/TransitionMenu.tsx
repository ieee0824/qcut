import { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface TransitionMenuProps {
  contextMenuPos: { x: number; y: number };
  onRemove: () => void;
  onClose: () => void;
}

export function TransitionMenu({ contextMenuPos: initialPos, onRemove, onClose }: TransitionMenuProps) {
  const { t } = useTranslation();
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [contextMenuPos, setContextMenuPos] = useState(initialPos);

  // コンテキストメニューが画面外にはみ出る場合、位置を自動補正
  useEffect(() => {
    if (!contextMenuRef.current) return;
    const menu = contextMenuRef.current;
    const rect = menu.getBoundingClientRect();
    let { x, y } = contextMenuPos;
    if (rect.right > window.innerWidth) {
      x = window.innerWidth - rect.width;
    }
    if (rect.bottom > window.innerHeight) {
      y = window.innerHeight - rect.height;
    }
    if (x !== contextMenuPos.x || y !== contextMenuPos.y) {
      setContextMenuPos({ x, y });
    }
  }, [contextMenuPos]);

  return (
    <>
      <div className="context-menu-overlay" onClick={onClose} />
      <div
        ref={contextMenuRef}
        className="context-menu"
        style={{ left: `${contextMenuPos.x}px`, top: `${contextMenuPos.y}px` }}
      >
        <button className="context-menu-item" onClick={onRemove}>
          🗑️ {t('transition.remove')}
        </button>
      </div>
    </>
  );
}
