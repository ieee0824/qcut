import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ColorWheel } from './ColorWheel';
import type { ClipEffects } from '../../store/timelineStore';

interface ColorWheelPanelProps {
  effects: ClipEffects;
  onChange: (key: keyof ClipEffects, value: number) => void;
}

export const ColorWheelPanel: React.FC<ColorWheelPanelProps> = ({ effects, onChange }) => {
  const { t } = useTranslation();

  const handleLiftChange = useCallback(
    (r: number, g: number, b: number) => {
      onChange('liftR', r);
      onChange('liftG', g);
      onChange('liftB', b);
    },
    [onChange],
  );

  const handleGammaChange = useCallback(
    (r: number, g: number, b: number) => {
      onChange('gammaR', r);
      onChange('gammaG', g);
      onChange('gammaB', b);
    },
    [onChange],
  );

  const handleGainChange = useCallback(
    (r: number, g: number, b: number) => {
      onChange('gainR', r);
      onChange('gainG', g);
      onChange('gainB', b);
    },
    [onChange],
  );

  return (
    <div>
      <h4
        style={{
          margin: '16px 0 8px 0',
          fontSize: '13px',
          color: '#ddd',
          borderTop: '1px solid #3a3a3a',
          paddingTop: '12px',
        }}
      >
        {t('effects.colorWheel')}
      </h4>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        <ColorWheel
          label={t('effects.lift')}
          r={effects.liftR}
          g={effects.liftG}
          b={effects.liftB}
          onChange={handleLiftChange}
          size={90}
        />
        <ColorWheel
          label={t('effects.gamma')}
          r={effects.gammaR}
          g={effects.gammaG}
          b={effects.gammaB}
          onChange={handleGammaChange}
          size={90}
        />
        <ColorWheel
          label={t('effects.gain')}
          r={effects.gainR}
          g={effects.gainG}
          b={effects.gainB}
          onChange={handleGainChange}
          size={90}
        />
      </div>
    </div>
  );
};
