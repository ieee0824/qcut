import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useEffectPresetStore } from '../../store/effectPresetStore';
import { BUILT_IN_EFFECT_PRESETS } from '../../data/effectPresets';
import type { EffectPreset, EffectPresetCategory } from '../../data/effectPresets';
import type { ClipEffects } from '../../store/timelineStore';
import { logAction } from '../../store/actionLogger';

const CATEGORIES: { key: EffectPresetCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'effectPreset.all' },
  { key: 'voice', label: 'effectPreset.voice' },
  { key: 'music', label: 'effectPreset.music' },
  { key: 'scene', label: 'effectPreset.scene' },
  { key: 'custom', label: 'effectPreset.custom' },
];

interface EffectPresetPanelProps {
  effects: ClipEffects;
  onApply: (updates: Partial<ClipEffects>) => void;
}

export const EffectPresetPanel: React.FC<EffectPresetPanelProps> = ({ effects, onApply }) => {
  const { t } = useTranslation();
  const customPresets = useEffectPresetStore((s) => s.customPresets);
  const loadPresets = useEffectPresetStore((s) => s.loadPresets);
  const addPreset = useEffectPresetStore((s) => s.addPreset);
  const removePreset = useEffectPresetStore((s) => s.removePreset);
  const loaded = useEffectPresetStore((s) => s.loaded);

  const [filter, setFilter] = useState<EffectPresetCategory | 'all'>('all');
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  useEffect(() => {
    if (!loaded) {
      loadPresets();
    }
  }, [loaded, loadPresets]);

  const allPresets = [...BUILT_IN_EFFECT_PRESETS, ...customPresets];
  const filteredPresets = filter === 'all' ? allPresets : allPresets.filter(p => p.category === filter);

  const handleApply = useCallback((preset: EffectPreset) => {
    logAction('effectPreset:apply', JSON.stringify({ id: preset.id, name: preset.name, effects: preset.effects }));
    onApply(preset.effects);
    setSelectedPresetId(preset.id);
  }, [onApply]);

  const handleSave = useCallback(async () => {
    if (!saveName.trim()) return;
    await addPreset(saveName.trim(), effects);
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
              backgroundColor: selectedPresetId === preset.id ? '#4a4a4a' : '#333',
              borderRadius: '4px',
              cursor: 'pointer',
              border: selectedPresetId === preset.id ? '1px solid #888' : '1px solid #444',
              fontSize: '10px',
              color: selectedPresetId === preset.id ? '#fff' : '#ccc',
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
          {t('effectPreset.saveAsPreset')}
        </button>
      )}
    </div>
  );
};
