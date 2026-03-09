import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTimelineStore, DEFAULT_TEXT_PROPERTIES } from '../../store/timelineStore';
import type { TextProperties, TextAnimation } from '../../store/timelineStore';
import { PropertySlider } from './PropertySlider';
import {
  FONT_SIZE_SLIDER,
  POSITION_SLIDERS,
  ANIMATION_DURATION_SLIDER,
} from './textSliderDefinitions';

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

  const labelStyle: React.CSSProperties = { fontSize: '12px', color: '#ccc' };
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
          <PropertySlider
            label={t(FONT_SIZE_SLIDER.label)}
            value={tp[FONT_SIZE_SLIDER.key] as number}
            onChange={(v) => handleChange(FONT_SIZE_SLIDER.key, v)}
            min={FONT_SIZE_SLIDER.min}
            max={FONT_SIZE_SLIDER.max}
            step={FONT_SIZE_SLIDER.step}
            decimals={FONT_SIZE_SLIDER.decimals}
            suffix={FONT_SIZE_SLIDER.suffix}
          />

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

          {/* 位置・透明度 */}
          {POSITION_SLIDERS.map((s) => (
            <PropertySlider
              key={s.key}
              label={t(s.label)}
              value={tp[s.key] as number}
              onChange={(v) => handleChange(s.key, v)}
              min={s.min}
              max={s.max}
              step={s.step}
              decimals={s.decimals}
              suffix={s.suffix}
            />
          ))}

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
            <PropertySlider
              label={t(ANIMATION_DURATION_SLIDER.label)}
              value={tp[ANIMATION_DURATION_SLIDER.key] as number}
              onChange={(v) => handleChange(ANIMATION_DURATION_SLIDER.key, v)}
              min={ANIMATION_DURATION_SLIDER.min}
              max={ANIMATION_DURATION_SLIDER.max}
              step={ANIMATION_DURATION_SLIDER.step}
              decimals={ANIMATION_DURATION_SLIDER.decimals}
              suffix={ANIMATION_DURATION_SLIDER.suffix}
            />
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
