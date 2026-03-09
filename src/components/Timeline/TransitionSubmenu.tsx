import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTransitionPresetStore } from '../../store/transitionPresetStore';
import type { TransitionType } from '../../store/timelineStore';

interface TransitionSubmenuProps {
  onSelectTransition: (type: TransitionType, duration: number) => void;
}

export function TransitionSubmenu({ onSelectTransition }: TransitionSubmenuProps) {
  const { t } = useTranslation();
  const allPresets = useTransitionPresetStore((s) => s.getAllPresets)();
  const submenuRef = useRef<HTMLDivElement>(null);

  // サブメニューが画面外にはみ出る場合、位置を自動補正
  useEffect(() => {
    if (!submenuRef.current) return;
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
  }, []);

  return (
    <div ref={submenuRef} className="context-submenu">
      {allPresets.map(preset => (
        <button
          key={preset.id}
          className="context-menu-item"
          onClick={(e) => {
            e.stopPropagation();
            onSelectTransition(preset.type, preset.duration);
          }}
        >
          {preset.isBuiltIn ? t(preset.name) : preset.name}
        </button>
      ))}
    </div>
  );
}
