import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TimecodeOverlay, TimecodeFormat } from '../../store/timelineStore';
import { DEFAULT_TIMECODE_OVERLAY } from '../../store/timelineStore';
import { formatTimecode } from '../../utils/timecode';

interface TimecodePanelProps {
  timecodeOverlay: TimecodeOverlay;
  onChange: (overlay: TimecodeOverlay) => void;
}

const FORMAT_OPTIONS: { value: TimecodeFormat; example: string }[] = [
  { value: 'ymd-hm', example: '2024年1月15日 10:00' },
  { value: 'md-hm', example: '1月15日 10:00' },
  { value: 'hms', example: '10:00:00' },
  { value: 'hm', example: '10:00' },
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  fontSize: '12px',
  backgroundColor: '#3a3a3a',
  color: '#ccc',
  border: '1px solid #555',
  borderRadius: '4px',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#ccc',
  marginBottom: '4px',
  display: 'block',
};

export const TimecodePanel: React.FC<TimecodePanelProps> = ({ timecodeOverlay, onChange }) => {
  const { t } = useTranslation();
  const overlay = timecodeOverlay;

  const handleToggle = useCallback(() => {
    onChange({ ...overlay, enabled: !overlay.enabled });
  }, [overlay, onChange]);

  const handleFormatChange = useCallback((format: TimecodeFormat) => {
    onChange({ ...overlay, format });
  }, [overlay, onChange]);

  const dateTimeLocal = useMemo(() => {
    const d = new Date(overlay.startDateTime);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [overlay.startDateTime]);

  const handleDateTimeChange = useCallback((value: string) => {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      onChange({ ...overlay, startDateTime: d.getTime() });
    }
  }, [overlay, onChange]);

  const handleFontSizeChange = useCallback((value: number) => {
    onChange({ ...overlay, fontSize: Math.max(16, Math.min(120, value)) });
  }, [overlay, onChange]);

  const handleFontColorChange = useCallback((value: string) => {
    onChange({ ...overlay, fontColor: value });
  }, [overlay, onChange]);

  const handlePositionXChange = useCallback((value: number) => {
    onChange({ ...overlay, positionX: Math.max(0, Math.min(100, value)) });
  }, [overlay, onChange]);

  const handlePositionYChange = useCallback((value: number) => {
    onChange({ ...overlay, positionY: Math.max(0, Math.min(100, value)) });
  }, [overlay, onChange]);

  const preview = useMemo(() => {
    return formatTimecode(overlay.startDateTime, 0, overlay.format);
  }, [overlay.startDateTime, overlay.format]);

  return (
    <div>
      {/* 有効/無効トグル */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <input
          type="checkbox"
          checked={overlay.enabled}
          onChange={handleToggle}
          style={{ cursor: 'pointer' }}
        />
        <span style={{ fontSize: '12px', color: '#ccc' }}>{t('timecode.enable')}</span>
      </div>

      {overlay.enabled && (
        <>
          {/* プレビュー */}
          <div style={{
            marginBottom: '12px',
            padding: '8px',
            backgroundColor: '#1a1a1a',
            borderRadius: '4px',
            textAlign: 'center',
            fontSize: `${Math.min(overlay.fontSize, 20)}px`,
            color: overlay.fontColor,
            fontFamily: 'monospace',
          }}>
            {preview}
          </div>

          {/* 開始日時 */}
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>{t('timecode.startDateTime')}</label>
            <input
              type="datetime-local"
              value={dateTimeLocal}
              onChange={(e) => handleDateTimeChange(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* フォーマット */}
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>{t('timecode.format')}</label>
            <select
              value={overlay.format}
              onChange={(e) => handleFormatChange(e.target.value as TimecodeFormat)}
              style={inputStyle}
            >
              {FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.example}
                </option>
              ))}
            </select>
          </div>

          {/* フォントサイズ */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={labelStyle}>{t('timecode.fontSize')}</span>
              <span style={{ fontSize: '12px', color: '#999' }}>{overlay.fontSize}px</span>
            </div>
            <input
              type="range"
              min={16}
              max={120}
              step={1}
              value={overlay.fontSize}
              onChange={(e) => handleFontSizeChange(parseInt(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>

          {/* フォント色 */}
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>{t('timecode.fontColor')}</label>
            <input
              type="color"
              value={overlay.fontColor}
              onChange={(e) => handleFontColorChange(e.target.value)}
              style={{ width: '100%', height: '28px', cursor: 'pointer', border: 'none', backgroundColor: 'transparent' }}
            />
          </div>

          {/* 位置 X */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={labelStyle}>{t('timecode.positionX')}</span>
              <span style={{ fontSize: '12px', color: '#999' }}>{overlay.positionX}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={overlay.positionX}
              onChange={(e) => handlePositionXChange(parseInt(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>

          {/* 位置 Y */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={labelStyle}>{t('timecode.positionY')}</span>
              <span style={{ fontSize: '12px', color: '#999' }}>{overlay.positionY}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={overlay.positionY}
              onChange={(e) => handlePositionYChange(parseInt(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>

          {/* リセット */}
          <button
            onClick={() => onChange({ ...DEFAULT_TIMECODE_OVERLAY, enabled: true })}
            style={{
              width: '100%',
              padding: '4px',
              fontSize: '11px',
              backgroundColor: '#3a3a3a',
              color: '#999',
              border: '1px solid #555',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {t('timecode.reset')}
          </button>
        </>
      )}
    </div>
  );
};
