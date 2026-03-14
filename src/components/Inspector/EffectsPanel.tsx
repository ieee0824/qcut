import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTimelineStore, DEFAULT_EFFECTS, DEFAULT_TONE_CURVES, DEFAULT_TIMECODE_OVERLAY } from '../../store/timelineStore';
import type { ClipEffects, EasingType, Keyframe, ToneCurves, ToneCurveKeyframe, TimecodeOverlay } from '../../store/timelineStore';
import { ColorWheelPanel } from './ColorWheelPanel';
import { ColorPresetPanel } from './ColorPresetPanel';
import { CurveEditor } from './CurveEditor';
import { EffectPresetPanel } from './EffectPresetPanel';
import { KeyframeRow } from './KeyframeRow';
import { TimecodePanel } from './TimecodePanel';
import { ScopesPanel } from '../Scopes/ScopesPanel';
import {
  BASIC_SLIDERS,
  HSL_SLIDERS,
  TRANSFORM_SLIDERS,
  VOLUME_SLIDERS,
  EQ_SLIDERS,
  NOISE_REDUCTION_SLIDERS,
  ECHO_SLIDERS,
  REVERB_SLIDERS,
  FADE_SLIDERS,
  FILTER_SLIDERS,
} from './effectsSliderDefinitions';

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

  const addKeyframe = useTimelineStore((s) => s.addKeyframe);
  const removeKeyframe = useTimelineStore((s) => s.removeKeyframe);
  const updateKeyframeEasingStore = useTimelineStore((s) => s.updateKeyframeEasing);
  const addToneCurveKeyframe = useTimelineStore((s) => s.addToneCurveKeyframe);
  const removeToneCurveKeyframe = useTimelineStore((s) => s.removeToneCurveKeyframe);
  const currentTime = useTimelineStore((s) => s.currentTime);

  const selectedClip = useMemo(() => {
    if (!selectedClipId || !selectedTrackId) return null;
    const track = tracks.find((t) => t.id === selectedTrackId);
    return track?.clips.find((c) => c.id === selectedClipId) ?? null;
  }, [selectedClipId, selectedTrackId, tracks]);

  const clipLocalTime = useMemo(() => {
    if (!selectedClip) return 0;
    return Math.max(0, Math.min(selectedClip.duration, currentTime - selectedClip.startTime));
  }, [currentTime, selectedClip]);

  const effects: ClipEffects = useMemo(() => {
    return { ...DEFAULT_EFFECTS, ...selectedClip?.effects };
  }, [selectedClip?.effects]);

  const timecodeOverlay: TimecodeOverlay = useMemo(() => {
    return { ...DEFAULT_TIMECODE_OVERLAY, ...selectedClip?.timecodeOverlay };
  }, [selectedClip?.timecodeOverlay]);

  const toneCurveKeyframes = useMemo(() => selectedClip?.toneCurveKeyframes ?? [], [selectedClip?.toneCurveKeyframes]);

  const currentTcKf = useMemo(() => {
    return toneCurveKeyframes.find((kf) => Math.abs(kf.time - clipLocalTime) <= 0.001) ?? null;
  }, [toneCurveKeyframes, clipLocalTime]);

  const hasTcKfAtCurrentTime = currentTcKf !== null;

  // 現在時刻にKFがある場合はそのKFの値を表示、なければベースカーブ
  const toneCurves: ToneCurves = useMemo(() => {
    if (currentTcKf) return { ...currentTcKf.toneCurves };
    return { ...DEFAULT_TONE_CURVES, ...selectedClip?.toneCurves };
  }, [currentTcKf, selectedClip?.toneCurves]);

  const handleTimecodeChange = useCallback(
    (overlay: TimecodeOverlay) => {
      if (!selectedTrackId || !selectedClipId) return;
      updateClip(selectedTrackId, selectedClipId, {
        timecodeOverlay: overlay,
      });
    },
    [selectedTrackId, selectedClipId, updateClip],
  );

  const handleCurveCommit = useCallback(() => {
    commitHistory();
  }, [commitHistory]);

  const handleCurveChange = useCallback(
    (curves: ToneCurves) => {
      if (!selectedTrackId || !selectedClipId) return;
      // 現在時刻にトーンカーブKFが存在する場合はKF側を更新
      if (currentTcKf) {
        addToneCurveKeyframe(selectedTrackId, selectedClipId, {
          time: currentTcKf.time,
          toneCurves: { ...curves },
          easing: currentTcKf.easing,
        });
      } else {
        updateClipSilent(selectedTrackId, selectedClipId, { toneCurves: curves });
      }
    },
    [selectedTrackId, selectedClipId, updateClipSilent, currentTcKf, addToneCurveKeyframe],
  );

  const handleAddToneCurveKeyframe = useCallback(() => {
    if (!selectedTrackId || !selectedClipId) return;
    const kf: ToneCurveKeyframe = {
      time: Math.round(clipLocalTime * 100) / 100,
      toneCurves: { ...toneCurves },
      easing: 'linear',
    };
    addToneCurveKeyframe(selectedTrackId, selectedClipId, kf);
  }, [selectedTrackId, selectedClipId, clipLocalTime, toneCurves, addToneCurveKeyframe]);

  const handleRemoveToneCurveKeyframe = useCallback(() => {
    if (!selectedTrackId || !selectedClipId) return;
    removeToneCurveKeyframe(selectedTrackId, selectedClipId, clipLocalTime);
  }, [selectedTrackId, selectedClipId, clipLocalTime, removeToneCurveKeyframe]);

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

  const handleAddKeyframe = useCallback(
    (key: keyof ClipEffects, kf: Keyframe) => {
      if (!selectedTrackId || !selectedClipId) return;
      addKeyframe(selectedTrackId, selectedClipId, key, kf);
    },
    [selectedTrackId, selectedClipId, addKeyframe],
  );

  const handleRemoveKeyframe = useCallback(
    (key: keyof ClipEffects, time: number) => {
      if (!selectedTrackId || !selectedClipId) return;
      removeKeyframe(selectedTrackId, selectedClipId, key, time);
    },
    [selectedTrackId, selectedClipId, removeKeyframe],
  );

  const handleUpdateKeyframeEasing = useCallback(
    (key: keyof ClipEffects, time: number, easing: EasingType) => {
      if (!selectedTrackId || !selectedClipId) return;
      updateKeyframeEasingStore(selectedTrackId, selectedClipId, key, time, easing);
    },
    [selectedTrackId, selectedClipId, updateKeyframeEasingStore],
  );

  const handleReset = useCallback(() => {
    if (!selectedTrackId || !selectedClipId) return;
    updateClip(selectedTrackId, selectedClipId, {
      effects: { ...DEFAULT_EFFECTS },
      keyframes: undefined,
      toneCurves: undefined,
      toneCurveKeyframes: undefined,
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
          <CollapsibleSection id="effectPreset" title={t('effectPreset.title')} defaultOpen={false} sections={sections} onToggle={handleToggleSection}>
            <EffectPresetPanel
              effects={effects}
              onApply={(updates) => {
                if (!selectedTrackId || !selectedClipId) return;
                updateClip(selectedTrackId, selectedClipId, {
                  effects: { ...effects, ...updates },
                });
              }}
            />
          </CollapsibleSection>

          <CollapsibleSection id="colorPreset" title={t('colorPreset.title')} defaultOpen={false} sections={sections} onToggle={handleToggleSection}>
            <ColorPresetPanel
              effects={effects}
              onApply={(updates) => {
                if (!selectedTrackId || !selectedClipId) return;
                updateClip(selectedTrackId, selectedClipId, {
                  effects: { ...effects, ...updates },
                });
              }}
            />
          </CollapsibleSection>

          <CollapsibleSection id="filter" title={t('effects.filter')} defaultOpen={false} sections={sections} onToggle={handleToggleSection}>
            {FILTER_SLIDERS.map((s) => (
              <KeyframeRow
                key={s.key}
                effectKey={s.key}
                label={t(s.label)}
                value={effects[s.key] as number}
                onChange={(v) => handleChange(s.key, v)}
                onCommit={handleSliderCommit}
                min={s.min}
                max={s.max}
                step={s.step}
                keyframes={selectedClip?.keyframes?.[s.key]}
                onAddKeyframe={(kf) => handleAddKeyframe(s.key, kf)}
                onRemoveKeyframe={(time) => handleRemoveKeyframe(s.key, time)}
                onUpdateKeyframeEasing={(time, easing) => handleUpdateKeyframeEasing(s.key, time, easing)}
                clipLocalTime={clipLocalTime}
              />
            ))}
          </CollapsibleSection>

          <CollapsibleSection id="basic" title={t('effects.title')} sections={sections} onToggle={handleToggleSection}>
            {BASIC_SLIDERS.map((s) => (
              <KeyframeRow
                key={s.key}
                effectKey={s.key}
                label={t(s.label)}
                value={effects[s.key] as number}
                onChange={(v) => handleChange(s.key, v)}
                onCommit={handleSliderCommit}
                min={s.min}
                max={s.max}
                step={s.step}
                keyframes={selectedClip?.keyframes?.[s.key]}
                onAddKeyframe={(kf) => handleAddKeyframe(s.key, kf)}
                onRemoveKeyframe={(time) => handleRemoveKeyframe(s.key, time)}
                onUpdateKeyframeEasing={(time, easing) => handleUpdateKeyframeEasing(s.key, time, easing)}
                clipLocalTime={clipLocalTime}
              />
            ))}
          </CollapsibleSection>

          <CollapsibleSection id="hsl" title={t('effects.hsl')} defaultOpen={false} sections={sections} onToggle={handleToggleSection}>
            {HSL_SLIDERS.map((s) => (
              <KeyframeRow
                key={s.key}
                effectKey={s.key}
                label={t(s.label)}
                value={effects[s.key] as number}
                onChange={(v) => handleChange(s.key, v)}
                onCommit={handleSliderCommit}
                min={s.min}
                max={s.max}
                step={s.step}
                keyframes={selectedClip?.keyframes?.[s.key]}
                onAddKeyframe={(kf) => handleAddKeyframe(s.key, kf)}
                onRemoveKeyframe={(time) => handleRemoveKeyframe(s.key, time)}
                onUpdateKeyframeEasing={(time, easing) => handleUpdateKeyframeEasing(s.key, time, easing)}
                clipLocalTime={clipLocalTime}
              />
            ))}
          </CollapsibleSection>

          <CollapsibleSection id="toneCurve" title={t('effects.toneCurve')} defaultOpen={false} sections={sections} onToggle={handleToggleSection}>
            <CurveEditor toneCurves={toneCurves} onChange={handleCurveChange} onCommit={handleCurveCommit} />
            <div style={{ display: 'flex', gap: '4px', marginTop: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#999' }}>{t('effects.keyframe')}</span>
              {hasTcKfAtCurrentTime ? (
                <button
                  onClick={handleRemoveToneCurveKeyframe}
                  style={{ fontSize: '11px', padding: '2px 6px', background: '#c9302c', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                  {t('effects.removeKeyframe')}
                </button>
              ) : (
                <button
                  onClick={handleAddToneCurveKeyframe}
                  style={{ fontSize: '11px', padding: '2px 6px', background: '#444', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                >
                  {t('effects.addKeyframe')}
                </button>
              )}
              <span style={{ fontSize: '10px', color: '#666' }}>
                ({toneCurveKeyframes.length} {t('effects.keyframeCount')})
              </span>
            </div>
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
            {TRANSFORM_SLIDERS.map((s) => (
              <KeyframeRow
                key={s.key}
                effectKey={s.key}
                label={t(s.label)}
                value={effects[s.key] as number}
                onChange={(v) => handleChange(s.key, v)}
                onCommit={handleSliderCommit}
                min={s.min}
                max={s.max}
                step={s.step}
                keyframes={selectedClip?.keyframes?.[s.key]}
                onAddKeyframe={(kf) => handleAddKeyframe(s.key, kf)}
                onRemoveKeyframe={(time) => handleRemoveKeyframe(s.key, time)}
                onUpdateKeyframeEasing={(time, easing) => handleUpdateKeyframeEasing(s.key, time, easing)}
                clipLocalTime={clipLocalTime}
              />
            ))}
          </CollapsibleSection>

          <CollapsibleSection id="audio" title={t('effects.audio')} sections={sections} onToggle={handleToggleSection}>
            {VOLUME_SLIDERS.map((s) => (
              <KeyframeRow
                key={s.key}
                effectKey={s.key}
                label={t(s.label)}
                value={effects[s.key] as number}
                onChange={(v) => handleChange(s.key, v)}
                onCommit={handleSliderCommit}
                min={s.min}
                max={s.max}
                step={s.step}
                keyframes={selectedClip?.keyframes?.[s.key]}
                onAddKeyframe={(kf) => handleAddKeyframe(s.key, kf)}
                onRemoveKeyframe={(time) => handleRemoveKeyframe(s.key, time)}
                onUpdateKeyframeEasing={(time, easing) => handleUpdateKeyframeEasing(s.key, time, easing)}
                clipLocalTime={clipLocalTime}
              />
            ))}
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
            {EQ_SLIDERS.map((s) => (
              <KeyframeRow
                key={s.key}
                effectKey={s.key}
                label={t(s.label)}
                value={effects[s.key] as number}
                onChange={(v) => handleChange(s.key, v)}
                onCommit={handleSliderCommit}
                min={s.min}
                max={s.max}
                step={s.step}
                keyframes={selectedClip?.keyframes?.[s.key]}
                onAddKeyframe={(kf) => handleAddKeyframe(s.key, kf)}
                onRemoveKeyframe={(time) => handleRemoveKeyframe(s.key, time)}
                onUpdateKeyframeEasing={(time, easing) => handleUpdateKeyframeEasing(s.key, time, easing)}
                clipLocalTime={clipLocalTime}
              />
            ))}
          </CollapsibleSection>

          <CollapsibleSection id="noiseReduction" title={t('effects.noiseReduction')} defaultOpen={false} sections={sections} onToggle={handleToggleSection}>
            {NOISE_REDUCTION_SLIDERS.map((s) => (
              <KeyframeRow
                key={s.key}
                effectKey={s.key}
                label={t(s.label)}
                value={effects[s.key] as number}
                onChange={(v) => handleChange(s.key, v)}
                onCommit={handleSliderCommit}
                min={s.min}
                max={s.max}
                step={s.step}
                keyframes={selectedClip?.keyframes?.[s.key]}
                onAddKeyframe={(kf) => handleAddKeyframe(s.key, kf)}
                onRemoveKeyframe={(time) => handleRemoveKeyframe(s.key, time)}
                onUpdateKeyframeEasing={(time, easing) => handleUpdateKeyframeEasing(s.key, time, easing)}
                clipLocalTime={clipLocalTime}
              />
            ))}
          </CollapsibleSection>

          <CollapsibleSection id="echoReverb" title={t('effects.echoReverb')} defaultOpen={false} sections={sections} onToggle={handleToggleSection}>
            {ECHO_SLIDERS.map((s) => (
              <KeyframeRow
                key={s.key}
                effectKey={s.key}
                label={t(s.label)}
                value={effects[s.key] as number}
                onChange={(v) => handleChange(s.key, v)}
                onCommit={handleSliderCommit}
                min={s.min}
                max={s.max}
                step={s.step}
                keyframes={selectedClip?.keyframes?.[s.key]}
                onAddKeyframe={(kf) => handleAddKeyframe(s.key, kf)}
                onRemoveKeyframe={(time) => handleRemoveKeyframe(s.key, time)}
                onUpdateKeyframeEasing={(time, easing) => handleUpdateKeyframeEasing(s.key, time, easing)}
                clipLocalTime={clipLocalTime}
              />
            ))}
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
            {REVERB_SLIDERS.map((s) => (
              <KeyframeRow
                key={s.key}
                effectKey={s.key}
                label={t(s.label)}
                value={effects[s.key] as number}
                onChange={(v) => handleChange(s.key, v)}
                onCommit={handleSliderCommit}
                min={s.min}
                max={s.max}
                step={s.step}
                keyframes={selectedClip?.keyframes?.[s.key]}
                onAddKeyframe={(kf) => handleAddKeyframe(s.key, kf)}
                onRemoveKeyframe={(time) => handleRemoveKeyframe(s.key, time)}
                onUpdateKeyframeEasing={(time, easing) => handleUpdateKeyframeEasing(s.key, time, easing)}
                clipLocalTime={clipLocalTime}
              />
            ))}
          </CollapsibleSection>

          <CollapsibleSection id="fade" title={t('effects.fade')} defaultOpen={false} sections={sections} onToggle={handleToggleSection}>
            {FADE_SLIDERS.map((s) => (
              <KeyframeRow
                key={s.key}
                effectKey={s.key}
                label={t(s.label)}
                value={effects[s.key] as number}
                onChange={(v) => handleChange(s.key, v)}
                onCommit={handleSliderCommit}
                min={s.min}
                max={s.max}
                step={s.step}
                keyframes={selectedClip?.keyframes?.[s.key]}
                onAddKeyframe={(kf) => handleAddKeyframe(s.key, kf)}
                onRemoveKeyframe={(time) => handleRemoveKeyframe(s.key, time)}
                onUpdateKeyframeEasing={(time, easing) => handleUpdateKeyframeEasing(s.key, time, easing)}
                clipLocalTime={clipLocalTime}
              />
            ))}
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
