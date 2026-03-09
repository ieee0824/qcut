import React from 'react';
import { useTranslation } from 'react-i18next';
import { useScopeStore } from '../../store/scopeStore';
import type { ScopeType } from '../../store/scopeStore';
import { Histogram } from './Histogram';
import { Vectorscope } from './Vectorscope';
import { WaveformMonitor } from './WaveformMonitor';

const SCOPE_TYPES: ScopeType[] = ['histogram', 'vectorscope', 'waveform'];

const scopeI18nKey: Record<ScopeType, string> = {
  histogram: 'scope.histogram',
  vectorscope: 'scope.vectorscope',
  waveform: 'scope.waveform',
};

export const ScopesPanel: React.FC = () => {
  const { t } = useTranslation();
  const enabled = useScopeStore((s) => s.enabled);
  const setEnabled = useScopeStore((s) => s.setEnabled);
  const activeScopes = useScopeStore((s) => s.activeScopes);
  const toggleScope = useScopeStore((s) => s.toggleScope);
  const histogramData = useScopeStore((s) => s.histogramData);
  const vectorscopeData = useScopeStore((s) => s.vectorscopeData);
  const waveformData = useScopeStore((s) => s.waveformData);

  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#ccc', marginBottom: '8px' }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        {t('scope.enable')}
      </label>
      {enabled && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            {SCOPE_TYPES.map((scope) => (
              <label
                key={scope}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  color: activeScopes.has(scope) ? '#ccc' : '#666',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={activeScopes.has(scope)}
                  onChange={() => toggleScope(scope)}
                  style={{ width: '12px', height: '12px' }}
                />
                {t(scopeI18nKey[scope])}
              </label>
            ))}
          </div>
          {activeScopes.has('histogram') && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>
                {t('scope.histogram')}
              </div>
              <Histogram data={histogramData} />
            </div>
          )}
          {activeScopes.has('vectorscope') && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>
                {t('scope.vectorscope')}
              </div>
              <Vectorscope data={vectorscopeData} />
            </div>
          )}
          {activeScopes.has('waveform') && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>
                {t('scope.waveform')}
              </div>
              <WaveformMonitor data={waveformData} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
