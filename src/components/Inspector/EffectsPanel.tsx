import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTimelineStore, DEFAULT_EFFECTS, DEFAULT_TIMECODE_OVERLAY } from '../../store/timelineStore';
import type { ClipEffects, TimecodeOverlay } from '../../store/timelineStore';
import { ColorWheelPanel } from './ColorWheelPanel';
import { TimecodePanel } from './TimecodePanel';
import { ScopesPanel } from '../Scopes/ScopesPanel';

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

const STORAGE_KEY = 'qcut-effects-sections';

function loadSectionState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSectionState(state: Record<string, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

interface CollapsibleSectionProps {
  id: string;
  title: string;
  defaultOpen?: boolean;
  sections: Record<string, boolean>;
  onToggle: (id: string, defaultOpen: boolean) => void;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ id, title, defaultOpen = true, sections, onToggle, children }) => {
  const isOpen = sections[id] ?? defaultOpen;

  return (
    <div style={{ borderTop: '1px solid #3a3a3a', paddingTop: '4px', marginTop: '8px' }}>
      <button
        onClick={() => onToggle(id, defaultOpen ?? true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          width: '100%',
          padding: '4px 0',
          margin: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '13px',
          color: '#ddd',
          fontWeight: 'bold',
          textAlign: 'left',
        }}
      >
        <span style={{
          display: 'inline-block',
          width: '12px',
          fontSize: '10px',
          color: '#999',
          transition: 'transform 0.15s',
          transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
        }}>
          &#9654;
        </span>
        {title}
      </button>
      {isOpen && (
        <div style={{ paddingTop: '8px' }}>
          {children}
        </div>
      )}
    </div>
  );
};

interface EffectSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onCommit?: () => void;
  min?: number;
  max?: number;
  step?: number;
}

const EffectSlider: React.FC<EffectSliderProps> = ({ label, value, onChange, onCommit, min = 0, max = 2, step = 0.01 }) => {
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
        onPointerUp={() => onCommit?.()}
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
  const updateClipSilent = useTimelineStore((s) => s.updateClipSilent);
  const commitHistory = useTimelineStore((s) => s.commitHistory);
  const [sections, setSections] = useState<Record<string, boolean>>(loadSectionState);

  const handleToggleSection = useCallback((id: string, defaultOpen: boolean) => {
    setSections((prev) => {
      const next = { ...prev, [id]: !(prev[id] ?? defaultOpen) };
      saveSectionState(next);
      return next;
    });
  }, []);

  const selectedClip = useMemo(() => {
    if (!selectedClipId || !selectedTrackId) return null;
    const track = tracks.find((t) => t.id === selectedTrackId);
    return track?.clips.find((c) => c.id === selectedClipId) ?? null;
  }, [selectedClipId, selectedTrackId, tracks]);

  const effects: ClipEffects = useMemo(() => {
    return { ...DEFAULT_EFFECTS, ...selectedClip?.effects };
  }, [selectedClip?.effects]);

  const timecodeOverlay: TimecodeOverlay = useMemo(() => {
    return { ...DEFAULT_TIMECODE_OVERLAY, ...selectedClip?.timecodeOverlay };
  }, [selectedClip?.timecodeOverlay]);

  const handleTimecodeChange = useCallback(
    (overlay: TimecodeOverlay) => {
      if (!selectedTrackId || !selectedClipId) return;
      updateClip(selectedTrackId, selectedClipId, {
        timecodeOverlay: overlay,
      });
    },
    [selectedTrackId, selectedClipId, updateClip],
  );

  const handleChange = useCallback(
    (key: keyof ClipEffects, value: number) => {
      if (!selectedTrackId || !selectedClipId) return;
      updateClipSilent(selectedTrackId, selectedClipId, {
        effects: { ...effects, [key]: value },
      });
    },
    [selectedTrackId, selectedClipId, effects, updateClipSilent],
  );

  const handleSliderCommit = useCallback(() => {
    commitHistory();
  }, [commitHistory]);

  const handleBatchChange = useCallback(
    (updates: Partial<ClipEffects>) => {
      if (!selectedTrackId || !selectedClipId) return;
      updateClipSilent(selectedTrackId, selectedClipId, {
        effects: { ...effects, ...updates },
      });
    },
    [selectedTrackId, selectedClipId, effects, updateClipSilent],
  );

  const handleBatchCommit = useCallback(() => {
    commitHistory();
  }, [commitHistory]);

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
          <CollapsibleSection id="basic" title={t('effects.title')} sections={sections} onToggle={handleToggleSection}>
            <EffectSlider
              label={t('effects.brightness')}
              value={effects.brightness}
              onChange={(v) => handleChange('brightness', v)}
              onCommit={handleSliderCommit}
            />
            <EffectSlider
              label={t('effects.contrast')}
              value={effects.contrast}
              onChange={(v) => handleChange('contrast', v)}
              onCommit={handleSliderCommit}
            />
            <EffectSlider
              label={t('effects.saturation')}
              value={effects.saturation}
              onChange={(v) => handleChange('saturation', v)}
              onCommit={handleSliderCommit}
            />
            <EffectSlider
              label={t('effects.colorTemperature')}
              value={effects.colorTemperature}
              onChange={(v) => handleChange('colorTemperature', v)}
              onCommit={handleSliderCommit}
              min={-1}
              max={1}
              step={0.01}
            />
            <EffectSlider
              label={t('effects.hue')}
              value={effects.hue}
              onChange={(v) => handleChange('hue', v)}
              onCommit={handleSliderCommit}
              min={-180}
              max={180}
              step={1}
            />
          </CollapsibleSection>

          <CollapsibleSection id="hsl" title={t('effects.hsl')} defaultOpen={false} sections={sections} onToggle={handleToggleSection}>
            <EffectSlider
              label={t('effects.hslRedSat')}
              value={effects.hslRedSat}
              onChange={(v) => handleChange('hslRedSat', v)}
              onCommit={handleSliderCommit}
              min={-1}
              max={1}
              step={0.01}
            />
            <EffectSlider
              label={t('effects.hslYellowSat')}
              value={effects.hslYellowSat}
              onChange={(v) => handleChange('hslYellowSat', v)}
              onCommit={handleSliderCommit}
              min={-1}
              max={1}
              step={0.01}
            />
            <EffectSlider
              label={t('effects.hslGreenSat')}
              value={effects.hslGreenSat}
              onChange={(v) => handleChange('hslGreenSat', v)}
              onCommit={handleSliderCommit}
              min={-1}
              max={1}
              step={0.01}
            />
            <EffectSlider
              label={t('effects.hslCyanSat')}
              value={effects.hslCyanSat}
              onChange={(v) => handleChange('hslCyanSat', v)}
              onCommit={handleSliderCommit}
              min={-1}
              max={1}
              step={0.01}
            />
            <EffectSlider
              label={t('effects.hslBlueSat')}
              value={effects.hslBlueSat}
              onChange={(v) => handleChange('hslBlueSat', v)}
              onCommit={handleSliderCommit}
              min={-1}
              max={1}
              step={0.01}
            />
            <EffectSlider
              label={t('effects.hslMagentaSat')}
              value={effects.hslMagentaSat}
              onChange={(v) => handleChange('hslMagentaSat', v)}
              onCommit={handleSliderCommit}
              min={-1}
              max={1}
              step={0.01}
            />
          </CollapsibleSection>

          <CollapsibleSection id="colorWheel" title={t('effects.colorWheel')} defaultOpen={false} sections={sections} onToggle={handleToggleSection}>
            <ColorWheelPanel effects={effects} onBatchChange={handleBatchChange} onCommit={handleBatchCommit} />
          </CollapsibleSection>

          <CollapsibleSection id="scope" title={t('scope.title')} defaultOpen={false} sections={sections} onToggle={handleToggleSection}>
            <ScopesPanel />
          </CollapsibleSection>

          <CollapsibleSection id="timecode" title={t('timecode.title')} defaultOpen={false} sections={sections} onToggle={handleToggleSection}>
            <TimecodePanel timecodeOverlay={timecodeOverlay} filePath={selectedClip.filePath} onChange={handleTimecodeChange} />
          </CollapsibleSection>

          <CollapsibleSection id="transform" title={t('transform.title')} sections={sections} onToggle={handleToggleSection}>
            <EffectSlider
              label={t('transform.rotation')}
              value={effects.rotation}
              onChange={(v) => handleChange('rotation', v)}
              onCommit={handleSliderCommit}
              min={-180}
              max={180}
              step={1}
            />
            <EffectSlider
              label={t('transform.scaleX')}
              value={effects.scaleX}
              onChange={(v) => handleChange('scaleX', v)}
              onCommit={handleSliderCommit}
              min={0.1}
              max={3}
              step={0.01}
            />
            <EffectSlider
              label={t('transform.scaleY')}
              value={effects.scaleY}
              onChange={(v) => handleChange('scaleY', v)}
              onCommit={handleSliderCommit}
              min={0.1}
              max={3}
              step={0.01}
            />
            <EffectSlider
              label={t('transform.positionX')}
              value={effects.positionX}
              onChange={(v) => handleChange('positionX', v)}
              onCommit={handleSliderCommit}
              min={-500}
              max={500}
              step={1}
            />
            <EffectSlider
              label={t('transform.positionY')}
              value={effects.positionY}
              onChange={(v) => handleChange('positionY', v)}
              onCommit={handleSliderCommit}
              min={-500}
              max={500}
              step={1}
            />
          </CollapsibleSection>

          <CollapsibleSection id="audio" title={t('effects.audio')} sections={sections} onToggle={handleToggleSection}>
            <EffectSlider
              label={t('effects.volume')}
              value={effects.volume}
              onChange={(v) => handleChange('volume', v)}
              onCommit={handleSliderCommit}
              min={0}
              max={2}
              step={0.01}
            />
          </CollapsibleSection>

          <CollapsibleSection id="equalizer" title={t('effects.equalizer')} defaultOpen={false} sections={sections} onToggle={handleToggleSection}>
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
              onCommit={handleSliderCommit}
              min={-12}
              max={12}
              step={0.5}
            />
            <EffectSlider
              label={t('effects.eqMid')}
              value={effects.eqMid}
              onChange={(v) => handleChange('eqMid', v)}
              onCommit={handleSliderCommit}
              min={-12}
              max={12}
              step={0.5}
            />
            <EffectSlider
              label={t('effects.eqHigh')}
              value={effects.eqHigh}
              onChange={(v) => handleChange('eqHigh', v)}
              onCommit={handleSliderCommit}
              min={-12}
              max={12}
              step={0.5}
            />
          </CollapsibleSection>

          <CollapsibleSection id="noiseReduction" title={t('effects.noiseReduction')} defaultOpen={false} sections={sections} onToggle={handleToggleSection}>
            <EffectSlider
              label={t('effects.denoiseAmount')}
              value={effects.denoiseAmount}
              onChange={(v) => handleChange('denoiseAmount', v)}
              onCommit={handleSliderCommit}
              min={0}
              max={1}
              step={0.01}
            />
            <EffectSlider
              label={t('effects.highpassFreq')}
              value={effects.highpassFreq}
              onChange={(v) => handleChange('highpassFreq', v)}
              onCommit={handleSliderCommit}
              min={0}
              max={500}
              step={10}
            />
          </CollapsibleSection>

          <CollapsibleSection id="echoReverb" title={t('effects.echoReverb')} defaultOpen={false} sections={sections} onToggle={handleToggleSection}>
            <EffectSlider
              label={t('effects.echoDelay')}
              value={effects.echoDelay}
              onChange={(v) => handleChange('echoDelay', v)}
              onCommit={handleSliderCommit}
              min={0}
              max={1000}
              step={10}
            />
            <EffectSlider
              label={t('effects.echoDecay')}
              value={effects.echoDecay}
              onChange={(v) => handleChange('echoDecay', v)}
              onCommit={handleSliderCommit}
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
              onCommit={handleSliderCommit}
              min={0}
              max={1}
              step={0.01}
            />
          </CollapsibleSection>

          <CollapsibleSection id="fade" title={t('effects.fade')} defaultOpen={false} sections={sections} onToggle={handleToggleSection}>
            <EffectSlider
              label={t('effects.fadeIn')}
              value={effects.fadeIn}
              onChange={(v) => handleChange('fadeIn', v)}
              onCommit={handleSliderCommit}
              min={0}
              max={3}
              step={0.1}
            />
            <EffectSlider
              label={t('effects.fadeOut')}
              value={effects.fadeOut}
              onChange={(v) => handleChange('fadeOut', v)}
              onCommit={handleSliderCommit}
              min={0}
              max={3}
              step={0.1}
            />
          </CollapsibleSection>

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
              marginTop: '12px',
            }}
          >
            {t('effects.reset')}
          </button>
        </>
      )}
    </div>
  );
};
