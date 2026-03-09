import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useColorPresetStore } from '../../store/colorPresetStore';
import { DEFAULT_EFFECTS } from '../../store/timelineStore';
import type { ClipEffects } from '../../store/timelineStore';
import type { ColorPreset, ColorPresetCategory, ColorEffectFields } from '../../data/colorPresets';

const CATEGORIES: { key: ColorPresetCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'colorPreset.all' },
  { key: 'cinematic', label: 'colorPreset.cinematic' },
  { key: 'vintage', label: 'colorPreset.vintage' },
  { key: 'monochrome', label: 'colorPreset.monochrome' },
  { key: 'creative', label: 'colorPreset.creative' },
  { key: 'custom', label: 'colorPreset.custom' },
];

/** カラーエフェクトフィールドのキー一覧 */
const COLOR_EFFECT_KEYS: (keyof ColorEffectFields)[] = [
  'brightness', 'contrast', 'saturation', 'colorTemperature', 'hue',
  'hslRedSat', 'hslYellowSat', 'hslGreenSat', 'hslCyanSat', 'hslBlueSat', 'hslMagentaSat',
  'liftR', 'liftG', 'liftB', 'gammaR', 'gammaG', 'gammaB', 'gainR', 'gainG', 'gainB',
];

interface ColorPresetPanelProps {
  effects: ClipEffects;
  onApply: (updates: Partial<ClipEffects>) => void;
}

export const ColorPresetPanel: React.FC<ColorPresetPanelProps> = ({ effects, onApply }) => {
  const { t } = useTranslation();
  const getAllPresets = useColorPresetStore((s) => s.getAllPresets);
  const loadPresets = useColorPresetStore((s) => s.loadPresets);
  const addPreset = useColorPresetStore((s) => s.addPreset);
  const removePreset = useColorPresetStore((s) => s.removePreset);
  const loaded = useColorPresetStore((s) => s.loaded);

  const [filter, setFilter] = useState<ColorPresetCategory | 'all'>('all');
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  useEffect(() => {
    if (!loaded) {
      loadPresets();
    }
  }, [loaded, loadPresets]);

  const allPresets = getAllPresets();
  const filteredPresets = filter === 'all' ? allPresets : allPresets.filter(p => p.category === filter);

  const handleApply = useCallback((preset: ColorPreset) => {
    // デフォルト値から、プリセットのエフェクトで上書き
    const updates: Partial<ClipEffects> = {};
    for (const key of COLOR_EFFECT_KEYS) {
      if (key in preset.effects) {
        updates[key] = preset.effects[key] as number;
      } else {
        updates[key] = DEFAULT_EFFECTS[key];
      }
    }
    onApply(updates);
  }, [onApply]);

  const handleSave = useCallback(async () => {
    if (!saveName.trim()) return;
    const currentEffects: Partial<ColorEffectFields> = {};
    for (const key of COLOR_EFFECT_KEYS) {
      if (effects[key] !== DEFAULT_EFFECTS[key]) {
        currentEffects[key] = effects[key];
      }
    }
    await addPreset(saveName.trim(), currentEffects);
    setSaveName('');
    setShowSaveInput(false);
  }, [saveName, effects, addPreset]);

  return (
    <div>
      {/* カテゴリフィルタ */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setFilter(cat.key)}
            style={{
              padding: '2px 6px',
              fontSize: '10px',
              backgroundColor: filter === cat.key ? '#555' : '#3a3a3a',
              color: filter === cat.key ? '#fff' : '#999',
              border: '1px solid #555',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            {t(cat.label)}
          </button>
        ))}
      </div>

      {/* プリセットグリッド */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '8px' }}>
        {filteredPresets.map((preset) => (
          <div
            key={preset.id}
            style={{
              position: 'relative',
              padding: '6px 4px',
              backgroundColor: '#333',
              borderRadius: '4px',
              cursor: 'pointer',
              border: '1px solid #444',
              fontSize: '10px',
              color: '#ccc',
              textAlign: 'center',
              lineHeight: '1.3',
            }}
            onClick={() => handleApply(preset)}
          >
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {preset.isBuiltIn ? t(preset.name) : preset.name}
            </div>
            {!preset.isBuiltIn && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removePreset(preset.id);
                }}
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  width: '14px',
                  height: '14px',
                  padding: 0,
                  fontSize: '9px',
                  lineHeight: '14px',
                  backgroundColor: 'rgba(255,60,60,0.7)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                }}
                title={t('preset.delete')}
              >
                x
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 保存 */}
      {showSaveInput ? (
        <div style={{ display: 'flex', gap: '4px' }}>
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            placeholder={t('preset.namePlaceholder')}
            style={{
              flex: 1,
              padding: '4px',
              fontSize: '11px',
              backgroundColor: '#3a3a3a',
              color: '#ccc',
              border: '1px solid #555',
              borderRadius: '4px',
            }}
            autoFocus
          />
          <button
            onClick={handleSave}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              backgroundColor: '#3a3a3a',
              color: '#ccc',
              border: '1px solid #555',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {t('preset.save')}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowSaveInput(true)}
          style={{
            width: '100%',
            padding: '4px',
            fontSize: '11px',
            backgroundColor: '#3a3a3a',
            color: '#ccc',
            border: '1px solid #555',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {t('colorPreset.saveAsPreset')}
        </button>
      )}
    </div>
  );
};
