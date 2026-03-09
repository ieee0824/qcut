import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ColorWheel } from './ColorWheel';
import type { ClipEffects } from '../../store/timelineStore';

interface ColorWheelPanelProps {
  effects: ClipEffects;
  onBatchChange: (updates: Partial<ClipEffects>) => void;
  onCommit: () => void;
}

export const ColorWheelPanel: React.FC<ColorWheelPanelProps> = ({ effects, onBatchChange, onCommit }) => {
  const { t } = useTranslation();

  const handleLiftChange = useCallback(
    (r: number, g: number, b: number) => {
      onBatchChange({ liftR: r, liftG: g, liftB: b });
    },
    [onBatchChange],
  );

  const handleGammaChange = useCallback(
    (r: number, g: number, b: number) => {
      onBatchChange({ gammaR: r, gammaG: g, gammaB: b });
    },
    [onBatchChange],
  );

  const handleGainChange = useCallback(
    (r: number, g: number, b: number) => {
      onBatchChange({ gainR: r, gainG: g, gainB: b });
    },
    [onBatchChange],
  );

  return (
    <div>
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
          onCommit={onCommit}
          size={90}
        />
        <ColorWheel
          label={t('effects.gamma')}
          r={effects.gammaR}
          g={effects.gammaG}
          b={effects.gammaB}
          onChange={handleGammaChange}
          onCommit={onCommit}
          size={90}
        />
        <ColorWheel
          label={t('effects.gain')}
          r={effects.gainR}
          g={effects.gainG}
          b={effects.gainB}
          onChange={handleGainChange}
          onCommit={onCommit}
          size={90}
        />
      </div>
    </div>
  );
};
