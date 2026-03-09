import React from 'react';

export interface PropertySliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onCommit?: () => void;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  suffix?: string;
}

export const PropertySlider: React.FC<PropertySliderProps> = ({ label, value, onChange, onCommit, min = 0, max = 2, step = 0.01, decimals = 2, suffix = '' }) => {
  const displayValue = decimals === 0 ? String(Math.round(value)) : value.toFixed(decimals);

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '12px', color: '#ccc' }}>{label}</span>
        <span style={{ fontSize: '12px', color: '#999' }}>{displayValue}{suffix}</span>
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

export interface SliderDefinition<K extends string = string> {
  key: K;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  suffix?: string;
}
