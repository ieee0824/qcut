import React from 'react';
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

  const handleAddKeyframe = () => {
    onAddKeyframe({ time: Math.round(clipLocalTime * 100) / 100, value, easing: 'linear' });
    onCommit?.();
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
          {[...keyframes].sort((a, b) => a.time - b.time).map((kf) => (
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
              <span style={{ minWidth: '32px', color: '#ffd700' }}>{kf.time.toFixed(1)}s</span>
              <span style={{ minWidth: '30px', color: '#999' }}>{kf.value.toFixed(2)}</span>
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
          ))}
        </div>
      )}
    </div>
  );
};
