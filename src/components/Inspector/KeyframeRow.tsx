import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PropertySlider } from './PropertySlider';
import type { ClipEffects, EasingType, Keyframe } from '../../store/timelineStore';

interface KeyframeRowProps {
  effectKey: keyof ClipEffects;
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  suffix?: string;
  onChange: (v: number) => void;
  onCommit?: () => void;
  keyframes?: Keyframe[];
  onAddKeyframe: (kf: Keyframe) => void;
  onRemoveKeyframe: (time: number) => void;
  onUpdateKeyframeEasing: (time: number, easing: EasingType) => void;
  clipLocalTime: number;
}

interface EditingField {
  kfTime: number;
  field: 'time' | 'value';
  inputValue: string;
}

const inputStyle: React.CSSProperties = {
  width: '40px',
  fontSize: '11px',
  background: '#2a2a2a',
  color: '#ffd700',
  border: '1px solid #666',
  borderRadius: '2px',
  padding: '0 2px',
  outline: 'none',
};

export const KeyframeRow: React.FC<KeyframeRowProps> = ({
  label,
  value,
  min,
  max,
  step,
  decimals,
  suffix,
  onChange,
  onCommit,
  keyframes = [],
  onAddKeyframe,
  onRemoveKeyframe,
  onUpdateKeyframeEasing,
  clipLocalTime,
}) => {
  const { t } = useTranslation();
  const hasKf = keyframes.length > 0;
  const [editing, setEditing] = useState<EditingField | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddKeyframe = () => {
    onAddKeyframe({ time: Math.round(clipLocalTime * 100) / 100, value, easing: 'linear' });
    onCommit?.();
  };

  const startEditing = (kf: Keyframe, field: 'time' | 'value') => {
    const raw = field === 'time' ? kf.time.toFixed(2) : kf.value.toFixed(3);
    setEditing({ kfTime: kf.time, field, inputValue: raw });
    setTimeout(() => {
      inputRef.current?.select();
    }, 0);
  };

  const commitEditing = (kf: Keyframe) => {
    if (!editing) return;
    const num = parseFloat(editing.inputValue);
    if (!isNaN(num)) {
      if (editing.field === 'time') {
        const newTime = Math.max(0, Math.round(num * 100) / 100);
        if (Math.abs(newTime - kf.time) > 0.001) {
          onRemoveKeyframe(kf.time);
          onAddKeyframe({ time: newTime, value: kf.value, easing: kf.easing });
        }
      } else {
        onAddKeyframe({ time: kf.time, value: num, easing: kf.easing });
      }
    }
    setEditing(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, kf: Keyframe) => {
    if (e.key === 'Enter') {
      commitEditing(kf);
    } else if (e.key === 'Escape') {
      setEditing(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2px' }}>
        <div style={{ flex: 1 }}>
          <PropertySlider
            label={label}
            value={value}
            min={min}
            max={max}
            step={step}
            decimals={decimals}
            suffix={suffix}
            onChange={onChange}
            onCommit={onCommit}
          />
        </div>
        <button
          onClick={handleAddKeyframe}
          title={t('keyframe.addKeyframe')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: hasKf ? '#ffd700' : '#555',
            fontSize: '12px',
            padding: '4px 6px',
            lineHeight: 1,
            flexShrink: 0,
            alignSelf: 'center',
          }}
        >
          ◆
        </button>
      </div>

      {hasKf && (
        <div style={{ marginBottom: '6px', paddingLeft: '2px' }}>
          {[...keyframes].sort((a, b) => a.time - b.time).map((kf) => {
            const isEditingTime = editing?.kfTime === kf.time && editing.field === 'time';
            const isEditingValue = editing?.kfTime === kf.time && editing.field === 'value';
            return (
              <div
                key={kf.time}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginBottom: '2px',
                  fontSize: '11px',
                  color: '#bbb',
                }}
              >
                {isEditingTime ? (
                  <input
                    ref={inputRef}
                    type="number"
                    value={editing!.inputValue}
                    onChange={(e) => setEditing({ ...editing!, inputValue: e.target.value })}
                    onBlur={() => commitEditing(kf)}
                    onKeyDown={(e) => handleKeyDown(e, kf)}
                    style={{ ...inputStyle, width: '44px', color: '#ffd700' }}
                  />
                ) : (
                  <span
                    style={{ minWidth: '32px', color: '#ffd700', cursor: 'text' }}
                    title={t('keyframe.editTime')}
                    onClick={() => startEditing(kf, 'time')}
                  >
                    {kf.time.toFixed(1)}s
                  </span>
                )}
                {isEditingValue ? (
                  <input
                    ref={isEditingTime ? undefined : inputRef}
                    type="number"
                    value={editing!.inputValue}
                    onChange={(e) => setEditing({ ...editing!, inputValue: e.target.value })}
                    onBlur={() => commitEditing(kf)}
                    onKeyDown={(e) => handleKeyDown(e, kf)}
                    style={{ ...inputStyle, width: '44px', color: '#999' }}
                  />
                ) : (
                  <span
                    style={{ minWidth: '30px', color: '#999', cursor: 'text' }}
                    title={t('keyframe.editValue')}
                    onClick={() => startEditing(kf, 'value')}
                  >
                    {kf.value.toFixed(2)}
                  </span>
                )}
                <select
                  value={kf.easing}
                  onChange={(e) => onUpdateKeyframeEasing(kf.time, e.target.value as EasingType)}
                  style={{
                    flex: 1,
                    fontSize: '10px',
                    background: '#1e1e1e',
                    color: '#bbb',
                    border: '1px solid #444',
                    padding: '1px 2px',
                    borderRadius: '2px',
                  }}
                >
                  <option value="linear">{t('keyframe.linear')}</option>
                  <option value="easeIn">{t('keyframe.easeIn')}</option>
                  <option value="easeOut">{t('keyframe.easeOut')}</option>
                  <option value="easeInOut">{t('keyframe.easeInOut')}</option>
                </select>
                <button
                  onClick={() => onRemoveKeyframe(kf.time)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#777',
                    fontSize: '10px',
                    padding: '0 2px',
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
