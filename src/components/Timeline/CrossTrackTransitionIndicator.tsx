import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useTimelineStore,
  type CrossTrackTransition,
  type Clip as ClipType,
  type TransitionType,
} from '../../store/timelineStore';
import { useTransitionPresetStore } from '../../store/transitionPresetStore';

interface CrossTrackTransitionIndicatorProps {
  transition: CrossTrackTransition;
  sourceClip: ClipType;
  targetClip: ClipType;
  sourceTrackIndex: number;
  targetTrackIndex: number;
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

function CrossTrackTransitionIndicator({
  transition,
  sourceClip,
  targetClip,
  sourceTrackIndex,
  targetTrackIndex,
}: CrossTrackTransitionIndicatorProps) {
  const { t } = useTranslation();
  const { pixelsPerSecond, updateCrossTrackTransition, removeCrossTrackTransition } = useTimelineStore();
  const allPresets = useTransitionPresetStore((s) => s.getAllPresets)();
  const addPreset = useTransitionPresetStore((s) => s.addPreset);
  const removePreset = useTransitionPresetStore((s) => s.removePreset);
  const [showPopover, setShowPopover] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });
  const [presetName, setPresetName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // 重複区間を計算
  const overlapStart = Math.max(sourceClip.startTime, targetClip.startTime);
  const overlapEnd = Math.min(
    sourceClip.startTime + sourceClip.duration,
    targetClip.startTime + targetClip.duration,
  );
  const transEnd = Math.min(overlapStart + transition.duration, overlapEnd);
  const effectiveDuration = transEnd - overlapStart;

  const left = overlapStart * pixelsPerSecond;
  const width = effectiveDuration * pixelsPerSecond;

  // トラック位置を計算（ルーラー高さ + トラック高さ × インデックス）
  const rulerHeight = 30;
  const trackHeight = 60;
  const topTrackIndex = Math.min(sourceTrackIndex, targetTrackIndex);
  const bottomTrackIndex = Math.max(sourceTrackIndex, targetTrackIndex);
  const top = rulerHeight + topTrackIndex * trackHeight;
  const height = (bottomTrackIndex - topTrackIndex + 1) * trackHeight;

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

  const handleSelectType = (type: TransitionType) => {
    updateCrossTrackTransition(transition.id, { type });
    setShowPopover(false);
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const duration = parseFloat(e.target.value);
    updateCrossTrackTransition(transition.id, { duration });
  };

  const handleRemove = () => {
    removeCrossTrackTransition(transition.id);
    setShowContextMenu(false);
  };

  // ポップオーバー位置自動補正
  useEffect(() => {
    if (!showPopover || !popoverRef.current || !indicatorRef.current) return;
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
  }, [showPopover, popoverPos]);

  // コンテキストメニュー位置自動補正
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
    if (x !== contextMenuPos.x || y !== contextMenuPos.y) {
      setContextMenuPos({ x, y });
    }
  }, [showContextMenu, contextMenuPos]);

  return (
    <>
      <div
        ref={indicatorRef}
        className="cross-track-transition-indicator"
        style={{
          left: `${left}px`,
          width: `${width}px`,
          top: `${top}px`,
          height: `${height}px`,
        }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        title={`${t('transition.crossTrack')}: ${t(TRANSITION_I18N_KEYS[transition.type])}`}
      >
        <span className="cross-track-transition-icon">⬥</span>
        <span className="cross-track-transition-label">
          {t(TRANSITION_I18N_KEYS[transition.type])}
        </span>
      </div>

      {showPopover && (
        <>
          <div className="context-menu-overlay" onClick={() => setShowPopover(false)} />
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
                        updateCrossTrackTransition(transition.id, { type: preset.type, duration: preset.duration });
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
            ref={contextMenuRef}
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

export default CrossTrackTransitionIndicator;
