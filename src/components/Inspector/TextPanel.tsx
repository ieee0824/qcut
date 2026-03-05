import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTimelineStore, DEFAULT_TEXT_PROPERTIES } from '../../store/timelineStore';
import type { TextProperties, TextAnimation } from '../../store/timelineStore';

export const TextPanel: React.FC = () => {
  const { t } = useTranslation();
  const selectedClipId = useTimelineStore((s) => s.selectedClipId);
  const selectedTrackId = useTimelineStore((s) => s.selectedTrackId);
  const tracks = useTimelineStore((s) => s.tracks);
  const updateClip = useTimelineStore((s) => s.updateClip);

  const selectedClip = useMemo(() => {
    if (!selectedClipId || !selectedTrackId) return null;
    const track = tracks.find((t) => t.id === selectedTrackId);
    return track?.clips.find((c) => c.id === selectedClipId) ?? null;
  }, [selectedClipId, selectedTrackId, tracks]);

  const isTextClip = useMemo(() => {
    if (!selectedTrackId) return false;
    const track = tracks.find((t) => t.id === selectedTrackId);
    return track?.type === 'text';
  }, [selectedTrackId, tracks]);

  const tp: TextProperties = useMemo(() => {
    return selectedClip?.textProperties ?? DEFAULT_TEXT_PROPERTIES;
  }, [selectedClip?.textProperties]);

  const handleChange = useCallback(
    (key: keyof TextProperties, value: TextProperties[keyof TextProperties]) => {
      if (!selectedTrackId || !selectedClipId) return;
      updateClip(selectedTrackId, selectedClipId, {
        textProperties: { ...tp, [key]: value },
      });
    },
    [selectedTrackId, selectedClipId, tp, updateClip],
  );

  const handleReset = useCallback(() => {
    if (!selectedTrackId || !selectedClipId) return;
    updateClip(selectedTrackId, selectedClipId, {
      textProperties: { ...DEFAULT_TEXT_PROPERTIES },
    });
  }, [selectedTrackId, selectedClipId, updateClip]);

  if (!isTextClip) return null;

  const sliderStyle: React.CSSProperties = { width: '100%', cursor: 'pointer' };
  const labelStyle: React.CSSProperties = { fontSize: '12px', color: '#ccc' };
  const valueStyle: React.CSSProperties = { fontSize: '12px', color: '#999' };
  const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' };
  const sectionStyle: React.CSSProperties = { marginBottom: '12px' };

  const animations: { value: TextAnimation; label: string }[] = [
    { value: 'none', label: t('text.none') },
    { value: 'fadeIn', label: t('text.fadeIn') },
    { value: 'fadeOut', label: t('text.fadeOut') },
    { value: 'fadeInOut', label: t('text.fadeInOut') },
    { value: 'slideUp', label: t('text.slideUp') },
    { value: 'slideDown', label: t('text.slideDown') },
  ];

  return (
    <div
      style={{
        width: '220px',
        minWidth: '220px',
        padding: '12px',
        backgroundColor: '#2a2a2a',
        borderLeft: '1px solid #3a3a3a',
        overflowY: 'auto',
      }}
    >
      <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#fff' }}>
        {t('text.title')}
      </h3>

      {!selectedClip ? (
        <p style={{ fontSize: '12px', color: '#888' }}>
          {t('text.noTextSelected')}
        </p>
      ) : (
        <>
          {/* テキスト入力 */}
          <div style={sectionStyle}>
            <span style={labelStyle}>{t('text.text')}</span>
            <textarea
              value={tp.text}
              onChange={(e) => handleChange('text', e.target.value)}
              style={{
                width: '100%',
                minHeight: '60px',
                marginTop: '4px',
                padding: '6px',
                fontSize: '12px',
                backgroundColor: '#1a1a1a',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: '4px',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* フォントサイズ */}
          <div style={sectionStyle}>
            <div style={rowStyle}>
              <span style={labelStyle}>{t('text.fontSize')}</span>
              <span style={valueStyle}>{tp.fontSize}px</span>
            </div>
            <input type="range" min={16} max={120} step={1} value={tp.fontSize}
              onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
              style={sliderStyle} />
          </div>

          {/* フォントカラー */}
          <div style={sectionStyle}>
            <div style={rowStyle}>
              <span style={labelStyle}>{t('text.fontColor')}</span>
              <input type="color" value={tp.fontColor}
                onChange={(e) => handleChange('fontColor', e.target.value)}
                style={{ width: '24px', height: '20px', border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }} />
            </div>
          </div>

          {/* フォントファミリー */}
          <div style={sectionStyle}>
            <span style={labelStyle}>{t('text.fontFamily')}</span>
            <select
              value={tp.fontFamily}
              onChange={(e) => handleChange('fontFamily', e.target.value)}
              style={{
                width: '100%',
                marginTop: '4px',
                padding: '4px',
                fontSize: '12px',
                backgroundColor: '#1a1a1a',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: '4px',
              }}
            >
              <option value="sans-serif">Sans-serif</option>
              <option value="serif">Serif</option>
              <option value="monospace">Monospace</option>
              <option value="cursive">Cursive</option>
            </select>
          </div>

          {/* Bold / Italic */}
          <div style={{ ...sectionStyle, display: 'flex', gap: '8px' }}>
            <button
              onClick={() => handleChange('bold', !tp.bold)}
              style={{
                flex: 1,
                padding: '4px',
                fontSize: '12px',
                fontWeight: 'bold',
                backgroundColor: tp.bold ? '#4a9eff' : '#3a3a3a',
                color: tp.bold ? '#fff' : '#ccc',
                border: '1px solid #555',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {t('text.bold')}
            </button>
            <button
              onClick={() => handleChange('italic', !tp.italic)}
              style={{
                flex: 1,
                padding: '4px',
                fontSize: '12px',
                fontStyle: 'italic',
                backgroundColor: tp.italic ? '#4a9eff' : '#3a3a3a',
                color: tp.italic ? '#fff' : '#ccc',
                border: '1px solid #555',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {t('text.italic')}
            </button>
          </div>

          {/* テキスト配置 */}
          <div style={{ ...sectionStyle, display: 'flex', gap: '4px' }}>
            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                key={align}
                onClick={() => handleChange('textAlign', align)}
                style={{
                  flex: 1,
                  padding: '4px',
                  fontSize: '11px',
                  backgroundColor: tp.textAlign === align ? '#4a9eff' : '#3a3a3a',
                  color: tp.textAlign === align ? '#fff' : '#ccc',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {align === 'left' ? '◀' : align === 'right' ? '▶' : '◆'}
              </button>
            ))}
          </div>

          {/* 位置 X */}
          <div style={sectionStyle}>
            <div style={rowStyle}>
              <span style={labelStyle}>{t('text.positionX')}</span>
              <span style={valueStyle}>{tp.positionX}%</span>
            </div>
            <input type="range" min={0} max={100} step={1} value={tp.positionX}
              onChange={(e) => handleChange('positionX', parseInt(e.target.value))}
              style={sliderStyle} />
          </div>

          {/* 位置 Y */}
          <div style={sectionStyle}>
            <div style={rowStyle}>
              <span style={labelStyle}>{t('text.positionY')}</span>
              <span style={valueStyle}>{tp.positionY}%</span>
            </div>
            <input type="range" min={0} max={100} step={1} value={tp.positionY}
              onChange={(e) => handleChange('positionY', parseInt(e.target.value))}
              style={sliderStyle} />
          </div>

          {/* 透明度 */}
          <div style={sectionStyle}>
            <div style={rowStyle}>
              <span style={labelStyle}>{t('text.opacity')}</span>
              <span style={valueStyle}>{tp.opacity.toFixed(2)}</span>
            </div>
            <input type="range" min={0} max={1} step={0.01} value={tp.opacity}
              onChange={(e) => handleChange('opacity', parseFloat(e.target.value))}
              style={sliderStyle} />
          </div>

          {/* 背景色 */}
          <div style={sectionStyle}>
            <div style={rowStyle}>
              <span style={labelStyle}>{t('text.backgroundColor')}</span>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input type="color" value={tp.backgroundColor === 'transparent' ? '#000000' : tp.backgroundColor}
                  onChange={(e) => handleChange('backgroundColor', e.target.value)}
                  style={{ width: '24px', height: '20px', border: 'none', cursor: 'pointer', backgroundColor: 'transparent' }} />
                <button
                  onClick={() => handleChange('backgroundColor', tp.backgroundColor === 'transparent' ? '#000000' : 'transparent')}
                  style={{
                    padding: '2px 6px',
                    fontSize: '10px',
                    backgroundColor: tp.backgroundColor === 'transparent' ? '#3a3a3a' : '#4a9eff',
                    color: '#ccc',
                    border: '1px solid #555',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                >
                  {tp.backgroundColor === 'transparent' ? 'OFF' : 'ON'}
                </button>
              </div>
            </div>
          </div>

          {/* アニメーション */}
          <div style={sectionStyle}>
            <span style={labelStyle}>{t('text.animation')}</span>
            <select
              value={tp.animation}
              onChange={(e) => handleChange('animation', e.target.value as TextAnimation)}
              style={{
                width: '100%',
                marginTop: '4px',
                padding: '4px',
                fontSize: '12px',
                backgroundColor: '#1a1a1a',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: '4px',
              }}
            >
              {animations.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>

          {/* アニメーション時間 */}
          {tp.animation !== 'none' && (
            <div style={sectionStyle}>
              <div style={rowStyle}>
                <span style={labelStyle}>{t('text.animationDuration')}</span>
                <span style={valueStyle}>{tp.animationDuration.toFixed(1)}s</span>
              </div>
              <input type="range" min={0.1} max={2} step={0.1} value={tp.animationDuration}
                onChange={(e) => handleChange('animationDuration', parseFloat(e.target.value))}
                style={sliderStyle} />
            </div>
          )}

          {/* リセット */}
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
              marginTop: '8px',
            }}
          >
            {t('effects.reset')}
          </button>
        </>
      )}
    </div>
  );
};
