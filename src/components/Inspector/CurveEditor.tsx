import React, { useRef, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ToneCurves } from '../../store/timelineStore';
import { DEFAULT_CURVE_POINTS } from '../../store/timelineStore';
import { buildCurveLUT } from '../../utils/curveSpline';

type CurveChannel = 'rgb' | 'r' | 'g' | 'b';

const CHANNEL_COLORS: Record<CurveChannel, string> = {
  rgb: '#cccccc',
  r: '#ff6666',
  g: '#66ff66',
  b: '#6666ff',
};

const CANVAS_SIZE = 196;
const PADDING = 4;
const DRAW_SIZE = CANVAS_SIZE - PADDING * 2;
const POINT_RADIUS = 5;
const HIT_RADIUS = 10;

interface CurveEditorProps {
  toneCurves: ToneCurves;
  onChange: (curves: ToneCurves) => void;
  onCommit: () => void;
}

export const CurveEditor: React.FC<CurveEditorProps> = ({ toneCurves, onChange, onCommit }) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeChannel, setActiveChannel] = useState<CurveChannel>('rgb');
  const dragIndexRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  const points = toneCurves[activeChannel];

  const toCanvasX = (x: number) => PADDING + x * DRAW_SIZE;
  const toCanvasY = (y: number) => PADDING + (1 - y) * DRAW_SIZE;
  const fromCanvasX = (cx: number) => (cx - PADDING) / DRAW_SIZE;
  const fromCanvasY = (cy: number) => 1 - (cy - PADDING) / DRAW_SIZE;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // 背景
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // グリッド線
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 4; i++) {
      const pos = PADDING + (DRAW_SIZE * i) / 4;
      ctx.beginPath();
      ctx.moveTo(pos, PADDING);
      ctx.lineTo(pos, PADDING + DRAW_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(PADDING, pos);
      ctx.lineTo(PADDING + DRAW_SIZE, pos);
      ctx.stroke();
    }

    // 対角線（リニア参照線）
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(toCanvasX(0), toCanvasY(0));
    ctx.lineTo(toCanvasX(1), toCanvasY(1));
    ctx.stroke();

    // 非アクティブチャンネルのカーブを薄く描画
    const channels: CurveChannel[] = ['r', 'g', 'b', 'rgb'];
    for (const ch of channels) {
      if (ch === activeChannel) continue;
      const chPoints = toneCurves[ch];
      const lut = buildCurveLUT(chPoints, DRAW_SIZE);
      ctx.strokeStyle = CHANNEL_COLORS[ch] + '40';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < DRAW_SIZE; i++) {
        const x = PADDING + i;
        const y = toCanvasY(lut[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // アクティブチャンネルのカーブ
    const lut = buildCurveLUT(points, DRAW_SIZE);
    ctx.strokeStyle = CHANNEL_COLORS[activeChannel];
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < DRAW_SIZE; i++) {
      const x = PADDING + i;
      const y = toCanvasY(lut[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 制御点
    for (const p of points) {
      ctx.fillStyle = CHANNEL_COLORS[activeChannel];
      ctx.beginPath();
      ctx.arc(toCanvasX(p.x), toCanvasY(p.y), POINT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [points, activeChannel, toneCurves]);

  useEffect(() => {
    draw();
  }, [draw]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_SIZE / rect.width;
    const scaleY = CANVAS_SIZE / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const findPointIndex = useCallback((cx: number, cy: number): number => {
    for (let i = 0; i < points.length; i++) {
      const px = toCanvasX(points[i].x);
      const py = toCanvasY(points[i].y);
      const dist = Math.sqrt((cx - px) ** 2 + (cy - py) ** 2);
      if (dist < HIT_RADIUS) return i;
    }
    return -1;
  }, [points]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x: cx, y: cy } = getCanvasCoords(e);
      const idx = findPointIndex(cx, cy);

      if (idx >= 0) {
        dragIndexRef.current = idx;
        isDraggingRef.current = true;
      } else {
        // 新しい点を追加
        const nx = clamp01(fromCanvasX(cx));
        const ny = clamp01(fromCanvasY(cy));
        // 既存の点と近すぎる場合は追加しない（重複防止）
        const MIN_X_DIST = 0.01;
        const tooClose = points.some((p) => Math.abs(p.x - nx) < MIN_X_DIST);
        if (tooClose) return;
        const newPoints = [...points, { x: nx, y: ny }].sort((a, b) => a.x - b.x);
        const newIdx = newPoints.findIndex((p) => Math.abs(p.x - nx) < 1e-6 && Math.abs(p.y - ny) < 1e-6);
        onChange({ ...toneCurves, [activeChannel]: newPoints });
        dragIndexRef.current = newIdx;
        isDraggingRef.current = true;
      }
    },
    [points, activeChannel, toneCurves, onChange, findPointIndex],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDraggingRef.current || dragIndexRef.current === null) return;
      const { x: cx, y: cy } = getCanvasCoords(e);
      const idx = dragIndexRef.current;
      const ny = clamp01(fromCanvasY(cy));

      // 端点はx固定
      if (idx === 0 || idx === points.length - 1) {
        const updated = [...points];
        updated[idx] = { ...updated[idx], y: ny };
        onChange({ ...toneCurves, [activeChannel]: updated });
        return;
      }

      // 中間点はx方向も移動可能（隣の点を超えない）
      const nx = clamp01(fromCanvasX(cx));
      const minX = points[idx - 1].x + 0.005;
      const maxX = points[idx + 1].x - 0.005;
      const updated = [...points];
      updated[idx] = { x: Math.max(minX, Math.min(maxX, nx)), y: ny };
      onChange({ ...toneCurves, [activeChannel]: updated });
    },
    [points, activeChannel, toneCurves, onChange],
  );

  const handleMouseUp = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      dragIndexRef.current = null;
      onCommit();
    }
  }, [onCommit]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x: cx, y: cy } = getCanvasCoords(e);
      const idx = findPointIndex(cx, cy);

      // 端点は削除不可
      if (idx > 0 && idx < points.length - 1) {
        const updated = points.filter((_, i) => i !== idx);
        onChange({ ...toneCurves, [activeChannel]: updated });
        onCommit();
      }
    },
    [points, activeChannel, toneCurves, onChange, onCommit, findPointIndex],
  );

  const handleReset = useCallback(() => {
    onChange({
      ...toneCurves,
      [activeChannel]: [...DEFAULT_CURVE_POINTS],
    });
    onCommit();
  }, [activeChannel, toneCurves, onChange, onCommit]);

  const handleResetAll = useCallback(() => {
    onChange({
      rgb: [...DEFAULT_CURVE_POINTS],
      r: [...DEFAULT_CURVE_POINTS],
      g: [...DEFAULT_CURVE_POINTS],
      b: [...DEFAULT_CURVE_POINTS],
    });
    onCommit();
  }, [onChange, onCommit]);

  return (
    <div>
      {/* チャンネルタブ */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '4px' }}>
        {(['rgb', 'r', 'g', 'b'] as CurveChannel[]).map((ch) => (
          <button
            key={ch}
            onClick={() => setActiveChannel(ch)}
            style={{
              flex: 1,
              padding: '3px 0',
              fontSize: '11px',
              fontWeight: activeChannel === ch ? 'bold' : 'normal',
              backgroundColor: activeChannel === ch ? '#3a3a3a' : 'transparent',
              color: CHANNEL_COLORS[ch],
              border: `1px solid ${activeChannel === ch ? '#555' : '#333'}`,
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            {ch.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{
          width: '100%',
          aspectRatio: '1',
          borderRadius: '4px',
          cursor: 'crosshair',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      />

      {/* リセットボタン */}
      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
        <button
          onClick={handleReset}
          style={{
            flex: 1,
            padding: '4px',
            fontSize: '11px',
            backgroundColor: '#3a3a3a',
            color: '#ccc',
            border: '1px solid #555',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          {t('effects.curveReset')}
        </button>
        <button
          onClick={handleResetAll}
          style={{
            flex: 1,
            padding: '4px',
            fontSize: '11px',
            backgroundColor: '#3a3a3a',
            color: '#ccc',
            border: '1px solid #555',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          {t('effects.curveResetAll')}
        </button>
      </div>
    </div>
  );
};

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
