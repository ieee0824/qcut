import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTimelineStore, type ClipTransition, type TransitionType } from '../../store/timelineStore';
import { useTransitionPresetStore } from '../../store/transitionPresetStore';

interface TransitionIndicatorProps {
  transition: ClipTransition;
  clipId: string;
  trackId: string;
  clipStartTime: number;
}

const TRANSITION_TYPES: TransitionType[] = [
  'crossfade',
  'dissolve',
  'wipe-left',
  'wipe-right',
  'wipe-up',
  'wipe-down',
];

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
  const { pixelsPerSecond, setTransition, removeTransition } = useTimelineStore();
  const allPresets = useTransitionPresetStore((s) => s.getAllPresets)();
  const addPreset = useTransitionPresetStore((s) => s.addPreset);
  const removePreset = useTransitionPresetStore((s) => s.removePreset);
  const [showPopover, setShowPopover] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [presetName, setPresetName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const width = transition.duration * pixelsPerSecond;
  const left = clipStartTime * pixelsPerSecond - width / 2;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPopover(!showPopover);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleSelectType = (type: TransitionType) => {
    setTransition(trackId, clipId, { ...transition, type });
    setShowPopover(false);
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const duration = parseFloat(e.target.value);
    setTransition(trackId, clipId, { ...transition, duration });
  };

  const handleRemove = () => {
    removeTransition(trackId, clipId);
    setShowContextMenu(false);
  };

  return (
    <>
      <div
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
        <>
          <div className="context-menu-overlay" onClick={() => setShowPopover(false)} />
          <div
            className="transition-popover"
            style={{ left: `${left}px` }}
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
                        setTransition(trackId, clipId, { type: preset.type, duration: preset.duration });
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
      )}

      {showContextMenu && (
        <>
          <div className="context-menu-overlay" onClick={() => setShowContextMenu(false)} />
          <div
            className="context-menu"
            style={{ left: `${contextMenuPos.x}px`, top: `${contextMenuPos.y}px` }}
          >
            <button className="context-menu-item" onClick={handleRemove}>
              🗑️ {t('transition.remove')}
            </button>
          </div>
        </>
      )}
    </>
  );
}

export default TransitionIndicator;
