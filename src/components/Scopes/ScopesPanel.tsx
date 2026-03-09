import React from 'react';
import { useTranslation } from 'react-i18next';
import { useScopeStore } from '../../store/scopeStore';
import { Histogram } from './Histogram';

export const ScopesPanel: React.FC = () => {
  const { t } = useTranslation();
  const enabled = useScopeStore((s) => s.enabled);
  const setEnabled = useScopeStore((s) => s.setEnabled);
  const histogramData = useScopeStore((s) => s.histogramData);

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
          <div style={{ fontSize: '11px', color: '#999', marginBottom: '4px' }}>
            {t('scope.histogram')}
          </div>
          <Histogram data={histogramData} />
        </div>
      )}
    </div>
  );
};
