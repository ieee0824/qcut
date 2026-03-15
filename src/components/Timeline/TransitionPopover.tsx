import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTimelineStore, type TimelineTransition, type TransitionType } from '../../store/timelineStore';
import { useTransitionPresetStore, BUILT_IN_PRESETS } from '../../store/transitionPresetStore';
import { TRANSITION_TYPES, TRANSITION_I18N_KEYS } from './transitionConstants';

interface TransitionPopoverProps {
  transition: TimelineTransition;
  popoverPos: { x: number; y: number };
  indicatorRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}

export function TransitionPopover({
  transition,
  popoverPos: initialPopoverPos,
  indicatorRef,
  onClose,
}: TransitionPopoverProps) {
  const { t } = useTranslation();
  const { updateTransition } = useTimelineStore();
  const customPresets = useTransitionPresetStore((s) => s.customPresets);
  const allPresets = [...BUILT_IN_PRESETS, ...customPresets];
  const addPreset = useTransitionPresetStore((s) => s.addPreset);
  const removePreset = useTransitionPresetStore((s) => s.removePreset);
  const [presetName, setPresetName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState(initialPopoverPos);

  const handleSelectType = (type: TransitionType) => {
    updateTransition(transition.id, { type });
    onClose();
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const duration = parseFloat(e.target.value);
    updateTransition(transition.id, { duration });
  };

  // ポップオーバーが画面外にはみ出る場合、位置を自動補正
  useEffect(() => {
    if (!popoverRef.current || !indicatorRef.current) return;
    const popover = popoverRef.current;
    const rect = popover.getBoundingClientRect();
    const indicatorRect = indicatorRef.current.getBoundingClientRect();
    let { x, y } = popoverPos;
    if (rect.bottom > window.innerHeight) {
      y = indicatorRect.top - rect.height - 4;
    }
    if (rect.right > window.innerWidth) {
      x = window.innerWidth - rect.width;
    }
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x !== popoverPos.x || y !== popoverPos.y) {
      setPopoverPos({ x, y });
    }
  }, [popoverPos, indicatorRef]);

  return (
    <>
      <div className="context-menu-overlay" onClick={onClose} />
      <div
        ref={popoverRef}
        className="transition-popover"
        style={{
          position: 'fixed',
          left: `${popoverPos.x}px`,
          top: `${popoverPos.y}px`,
          margin: 0,
        }}
      >
        {/* プリセット選択 */}
        <div className="transition-popover-presets">
          <label className="transition-popover-section-label">{t('preset.selectPreset')}</label>
          <div className="transition-popover-preset-list">
            {allPresets.map(preset => (
              <div key={preset.id} className="transition-popover-preset-row">
                <button
                  className="transition-popover-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateTransition(transition.id, { type: preset.type, duration: preset.duration });
                  }}
                >
                  {preset.isBuiltIn ? t(preset.name) : preset.name}
                </button>
                {!preset.isBuiltIn && (
                  <button
                    className="transition-popover-preset-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      removePreset(preset.id);
                    }}
                    title={t('preset.delete')}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 種類選択 */}
        <div className="transition-popover-types">
          {TRANSITION_TYPES.map(type => (
            <button
              key={type}
              className={`transition-popover-item ${type === transition.type ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); handleSelectType(type); }}
            >
              {t(TRANSITION_I18N_KEYS[type])}
            </button>
          ))}
        </div>
        <div className="transition-popover-duration">
          <label>{t('transition.duration')}</label>
          <input
            type="range"
            min="0.1"
            max="3.0"
            step="0.1"
            value={transition.duration}
            onChange={handleDurationChange}
            onClick={(e) => e.stopPropagation()}
          />
          <span>{transition.duration.toFixed(1)}s</span>
        </div>

        {/* プリセット保存 */}
        <div className="transition-popover-save">
          {showSaveInput ? (
            <div className="transition-popover-save-input">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder={t('preset.namePlaceholder')}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && presetName.trim()) {
                    addPreset(presetName.trim(), transition.type, transition.duration);
                    setPresetName('');
                    setShowSaveInput(false);
                  }
                }}
              />
              <button
                className="transition-popover-save-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (presetName.trim()) {
                    addPreset(presetName.trim(), transition.type, transition.duration);
                    setPresetName('');
                    setShowSaveInput(false);
                  }
                }}
              >
                ✓
              </button>
            </div>
          ) : (
            <button
              className="transition-popover-item"
              onClick={(e) => { e.stopPropagation(); setShowSaveInput(true); }}
            >
              💾 {t('preset.save')}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
