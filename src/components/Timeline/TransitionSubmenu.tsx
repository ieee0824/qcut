import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTransitionPresetStore, BUILT_IN_PRESETS } from '../../store/transitionPresetStore';
import type { TransitionType } from '../../store/timelineStore';

interface TransitionSubmenuProps {
  onSelectTransition: (type: TransitionType, duration: number) => void;
}

export function TransitionSubmenu({ onSelectTransition }: TransitionSubmenuProps) {
  const { t } = useTranslation();
  const customPresets = useTransitionPresetStore((s) => s.customPresets);
  const allPresets = [...BUILT_IN_PRESETS, ...customPresets];
  const submenuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden' });

  // サブメニューが画面外にはみ出る場合、位置を自動補正
  useEffect(() => {
    if (!submenuRef.current) return;
    const rect = submenuRef.current.getBoundingClientRect();
    const newStyle: React.CSSProperties = { visibility: 'visible' };

    if (rect.bottom > window.innerHeight) {
      const overflow = rect.bottom - window.innerHeight;
      newStyle.top = `${-overflow}px`;
    } else {
      newStyle.top = '0';
    }

    if (rect.right > window.innerWidth) {
      newStyle.left = 'auto';
      newStyle.right = '100%';
    } else {
      newStyle.left = '100%';
      newStyle.right = 'auto';
    }

    setStyle(newStyle);
  }, []);

  return (
    <div ref={submenuRef} className="context-submenu" style={style}>
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
