import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTimelineStore, DEFAULT_EFFECTS } from '../../store/timelineStore';
import type { ClipEffects } from '../../store/timelineStore';

interface EffectSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

const EffectSlider: React.FC<EffectSliderProps> = ({ label, value, onChange, min = 0, max = 2, step = 0.01 }) => {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '12px', color: '#ccc' }}>{label}</span>
        <span style={{ fontSize: '12px', color: '#999' }}>{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', cursor: 'pointer' }}
      />
    </div>
  );
};

export const EffectsPanel: React.FC = () => {
  const { t } = useTranslation();
  const selectedClipId = useTimelineStore((s) => s.selectedClipId);
  const selectedTrackId = useTimelineStore((s) => s.selectedTrackId);
  const tracks = useTimelineStore((s) => s.tracks);
  const updateClip = useTimelineStore((s) => s.updateClip);

  const selectedClip = useMemo(() => {
    if (!selectedClipId || !selectedTrackId) return null;
    const track = tracks.find((t) => t.id === selectedTrackId);
    return track?.clips.find((c) => c.id === selectedClipId) ?? null;
  }, [selectedClipId, selectedTrackId, tracks]);

  const effects: ClipEffects = useMemo(() => {
    return selectedClip?.effects ?? DEFAULT_EFFECTS;
  }, [selectedClip?.effects]);

  const handleChange = useCallback(
    (key: keyof ClipEffects, value: number) => {
      if (!selectedTrackId || !selectedClipId) return;
      updateClip(selectedTrackId, selectedClipId, {
        effects: { ...effects, [key]: value },
      });
    },
    [selectedTrackId, selectedClipId, effects, updateClip],
  );

  const handleReset = useCallback(() => {
    if (!selectedTrackId || !selectedClipId) return;
    updateClip(selectedTrackId, selectedClipId, {
      effects: { ...DEFAULT_EFFECTS },
    });
  }, [selectedTrackId, selectedClipId, updateClip]);

  return (
    <div
      style={{
        width: '220px',
        minWidth: '220px',
        padding: '12px',
        backgroundColor: '#2a2a2a',
        borderLeft: '1px solid #3a3a3a',
        overflowY: 'auto',
      }}
    >
      <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#fff' }}>
        {t('effects.title')}
      </h3>

      {!selectedClip ? (
        <p style={{ fontSize: '12px', color: '#888' }}>
          {t('effects.noClipSelected')}
        </p>
      ) : (
        <>
          <EffectSlider
            label={t('effects.brightness')}
            value={effects.brightness}
            onChange={(v) => handleChange('brightness', v)}
          />
          <EffectSlider
            label={t('effects.contrast')}
            value={effects.contrast}
            onChange={(v) => handleChange('contrast', v)}
          />
          <EffectSlider
            label={t('effects.saturation')}
            value={effects.saturation}
            onChange={(v) => handleChange('saturation', v)}
          />

          <h4 style={{ margin: '16px 0 8px 0', fontSize: '13px', color: '#ddd', borderTop: '1px solid #3a3a3a', paddingTop: '12px' }}>
            {t('transform.title')}
          </h4>
          <EffectSlider
            label={t('transform.rotation')}
            value={effects.rotation}
            onChange={(v) => handleChange('rotation', v)}
            min={-180}
            max={180}
            step={1}
          />
          <EffectSlider
            label={t('transform.scaleX')}
            value={effects.scaleX}
            onChange={(v) => handleChange('scaleX', v)}
            min={0.1}
            max={3}
            step={0.01}
          />
          <EffectSlider
            label={t('transform.scaleY')}
            value={effects.scaleY}
            onChange={(v) => handleChange('scaleY', v)}
            min={0.1}
            max={3}
            step={0.01}
          />
          <EffectSlider
            label={t('transform.positionX')}
            value={effects.positionX}
            onChange={(v) => handleChange('positionX', v)}
            min={-500}
            max={500}
            step={1}
          />
          <EffectSlider
            label={t('transform.positionY')}
            value={effects.positionY}
            onChange={(v) => handleChange('positionY', v)}
            min={-500}
            max={500}
            step={1}
          />

          <h4 style={{ margin: '16px 0 8px 0', fontSize: '13px', color: '#ddd', borderTop: '1px solid #3a3a3a', paddingTop: '12px' }}>
            {t('effects.fade')}
          </h4>
          <EffectSlider
            label={t('effects.fadeIn')}
            value={effects.fadeIn}
            onChange={(v) => handleChange('fadeIn', v)}
            min={0}
            max={3}
            step={0.1}
          />
          <EffectSlider
            label={t('effects.fadeOut')}
            value={effects.fadeOut}
            onChange={(v) => handleChange('fadeOut', v)}
            min={0}
            max={3}
            step={0.1}
          />

          <button
            onClick={handleReset}
            style={{
              width: '100%',
              padding: '6px',
              fontSize: '12px',
              backgroundColor: '#3a3a3a',
              color: '#ccc',
              border: '1px solid #555',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '8px',
            }}
          >
            {t('effects.reset')}
          </button>
        </>
      )}
    </div>
  );
};
