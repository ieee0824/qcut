import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTimelineStore, DEFAULT_EFFECTS } from '../../store/timelineStore';
import type { ClipEffects } from '../../store/timelineStore';

interface EqPreset {
  label: string;
  values: { eqLow: number; eqMid: number; eqHigh: number };
}

const EQ_PRESETS: EqPreset[] = [
  { label: 'effects.eqPresetFlat', values: { eqLow: 0, eqMid: 0, eqHigh: 0 } },
  { label: 'effects.eqPresetBassBoost', values: { eqLow: 6, eqMid: 0, eqHigh: 0 } },
  { label: 'effects.eqPresetVocal', values: { eqLow: -2, eqMid: 4, eqHigh: 2 } },
  { label: 'effects.eqPresetTrebleCut', values: { eqLow: 0, eqMid: 0, eqHigh: -6 } },
];

interface ReverbPreset {
  label: string;
  values: { reverbAmount: number };
}

const REVERB_PRESETS: ReverbPreset[] = [
  { label: 'effects.reverbOff', values: { reverbAmount: 0 } },
  { label: 'effects.reverbSmallRoom', values: { reverbAmount: 0.3 } },
  { label: 'effects.reverbHall', values: { reverbAmount: 0.6 } },
  { label: 'effects.reverbChurch', values: { reverbAmount: 0.9 } },
];

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
    return { ...DEFAULT_EFFECTS, ...selectedClip?.effects };
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
        height: '100%',
        minHeight: 0,
        padding: '12px',
        boxSizing: 'border-box',
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
          <EffectSlider
            label={t('effects.colorTemperature')}
            value={effects.colorTemperature}
            onChange={(v) => handleChange('colorTemperature', v)}
            min={-1}
            max={1}
            step={0.01}
          />
          <EffectSlider
            label={t('effects.hue')}
            value={effects.hue}
            onChange={(v) => handleChange('hue', v)}
            min={-180}
            max={180}
            step={1}
          />

          <h4 style={{ margin: '16px 0 8px 0', fontSize: '13px', color: '#ddd', borderTop: '1px solid #3a3a3a', paddingTop: '12px' }}>
            {t('effects.hsl')}
          </h4>
          <EffectSlider
            label={t('effects.hslRedSat')}
            value={effects.hslRedSat}
            onChange={(v) => handleChange('hslRedSat', v)}
            min={-1}
            max={1}
            step={0.01}
          />
          <EffectSlider
            label={t('effects.hslYellowSat')}
            value={effects.hslYellowSat}
            onChange={(v) => handleChange('hslYellowSat', v)}
            min={-1}
            max={1}
            step={0.01}
          />
          <EffectSlider
            label={t('effects.hslGreenSat')}
            value={effects.hslGreenSat}
            onChange={(v) => handleChange('hslGreenSat', v)}
            min={-1}
            max={1}
            step={0.01}
          />
          <EffectSlider
            label={t('effects.hslCyanSat')}
            value={effects.hslCyanSat}
            onChange={(v) => handleChange('hslCyanSat', v)}
            min={-1}
            max={1}
            step={0.01}
          />
          <EffectSlider
            label={t('effects.hslBlueSat')}
            value={effects.hslBlueSat}
            onChange={(v) => handleChange('hslBlueSat', v)}
            min={-1}
            max={1}
            step={0.01}
          />
          <EffectSlider
            label={t('effects.hslMagentaSat')}
            value={effects.hslMagentaSat}
            onChange={(v) => handleChange('hslMagentaSat', v)}
            min={-1}
            max={1}
            step={0.01}
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
            {t('effects.audio')}
          </h4>
          <EffectSlider
            label={t('effects.volume')}
            value={effects.volume}
            onChange={(v) => handleChange('volume', v)}
            min={0}
            max={2}
            step={0.01}
          />

          <h4 style={{ margin: '16px 0 8px 0', fontSize: '13px', color: '#ddd', borderTop: '1px solid #3a3a3a', paddingTop: '12px' }}>
            {t('effects.equalizer')}
          </h4>
          <div style={{ marginBottom: '8px' }}>
            <select
              onChange={(e) => {
                const preset = EQ_PRESETS[parseInt(e.target.value)];
                if (!preset || !selectedTrackId || !selectedClipId) return;
                updateClip(selectedTrackId, selectedClipId, {
                  effects: { ...effects, ...preset.values },
                });
              }}
              style={{
                width: '100%',
                padding: '4px',
                fontSize: '12px',
                backgroundColor: '#3a3a3a',
                color: '#ccc',
                border: '1px solid #555',
                borderRadius: '4px',
              }}
              value={(() => {
                const idx = EQ_PRESETS.findIndex(p =>
                  p.values.eqLow === effects.eqLow &&
                  p.values.eqMid === effects.eqMid &&
                  p.values.eqHigh === effects.eqHigh
                );
                return idx >= 0 ? String(idx) : '';
              })()}
            >
              <option value="" disabled>{t('effects.eqSelectPreset')}</option>
              {EQ_PRESETS.map((p, i) => (
                <option key={i} value={i}>{t(p.label)}</option>
              ))}
            </select>
          </div>
          <EffectSlider
            label={t('effects.eqLow')}
            value={effects.eqLow}
            onChange={(v) => handleChange('eqLow', v)}
            min={-12}
            max={12}
            step={0.5}
          />
          <EffectSlider
            label={t('effects.eqMid')}
            value={effects.eqMid}
            onChange={(v) => handleChange('eqMid', v)}
            min={-12}
            max={12}
            step={0.5}
          />
          <EffectSlider
            label={t('effects.eqHigh')}
            value={effects.eqHigh}
            onChange={(v) => handleChange('eqHigh', v)}
            min={-12}
            max={12}
            step={0.5}
          />

          <h4 style={{ margin: '16px 0 8px 0', fontSize: '13px', color: '#ddd', borderTop: '1px solid #3a3a3a', paddingTop: '12px' }}>
            {t('effects.noiseReduction')}
          </h4>
          <EffectSlider
            label={t('effects.denoiseAmount')}
            value={effects.denoiseAmount}
            onChange={(v) => handleChange('denoiseAmount', v)}
            min={0}
            max={1}
            step={0.01}
          />
          <EffectSlider
            label={t('effects.highpassFreq')}
            value={effects.highpassFreq}
            onChange={(v) => handleChange('highpassFreq', v)}
            min={0}
            max={500}
            step={10}
          />

          <h4 style={{ margin: '16px 0 8px 0', fontSize: '13px', color: '#ddd', borderTop: '1px solid #3a3a3a', paddingTop: '12px' }}>
            {t('effects.echoReverb')}
          </h4>
          <EffectSlider
            label={t('effects.echoDelay')}
            value={effects.echoDelay}
            onChange={(v) => handleChange('echoDelay', v)}
            min={0}
            max={1000}
            step={10}
          />
          <EffectSlider
            label={t('effects.echoDecay')}
            value={effects.echoDecay}
            onChange={(v) => handleChange('echoDecay', v)}
            min={0}
            max={0.9}
            step={0.01}
          />
          <div style={{ marginBottom: '8px' }}>
            <select
              onChange={(e) => {
                const preset = REVERB_PRESETS[parseInt(e.target.value)];
                if (!preset || !selectedTrackId || !selectedClipId) return;
                updateClip(selectedTrackId, selectedClipId, {
                  effects: { ...effects, ...preset.values },
                });
              }}
              style={{
                width: '100%',
                padding: '4px',
                fontSize: '12px',
                backgroundColor: '#3a3a3a',
                color: '#ccc',
                border: '1px solid #555',
                borderRadius: '4px',
              }}
              value={(() => {
                const idx = REVERB_PRESETS.findIndex(p => p.values.reverbAmount === effects.reverbAmount);
                return idx >= 0 ? String(idx) : '';
              })()}
            >
              <option value="" disabled>{t('effects.reverbSelectPreset')}</option>
              {REVERB_PRESETS.map((p, i) => (
                <option key={i} value={i}>{t(p.label)}</option>
              ))}
            </select>
          </div>
          <EffectSlider
            label={t('effects.reverbAmount')}
            value={effects.reverbAmount}
            onChange={(v) => handleChange('reverbAmount', v)}
            min={0}
            max={1}
            step={0.01}
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
