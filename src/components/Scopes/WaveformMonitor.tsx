/* eslint-disable no-undef */
import React, { useRef, useEffect } from 'react';
import type { WaveformData } from '../../utils/scopeAnalysis';

interface WaveformMonitorProps {
  data: WaveformData | null;
  width?: number;
  height?: number;
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  data: WaveformData,
  w: number,
  h: number,
) {
  ctx.clearRect(0, 0, w, h);

  // 背景
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, w, h);

  // 水平グリッドライン（IRE基準: 0%, 25%, 50%, 75%, 100%）
  ctx.strokeStyle = 'rgba(80, 80, 80, 0.4)';
  ctx.lineWidth = 0.5;
  for (const pct of [0, 0.25, 0.5, 0.75, 1.0]) {
    const y = h - pct * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  if (data.peak === 0 || data.columns === 0) return;

  const imageData = ctx.createImageData(w, h);
  const out = imageData.data;
  const logPeak = Math.log(data.peak + 1);
  const colScale = w / data.columns;

  for (let col = 0; col < data.columns; col++) {
    const pxStart = (col * colScale) | 0;
    const pxEnd = Math.min(w, ((col + 1) * colScale) | 0);
    if (pxStart >= w) continue;

    for (let luma = 0; luma < 256; luma++) {
      const count = data.density[col * 256 + luma];
      if (count === 0) continue;

      const intensity = Math.log(count + 1) / logPeak;

      // 輝度0が下、255が上
      const py = (h - 1 - ((luma / 255) * (h - 1)) | 0);
      if (py < 0 || py >= h) continue;

      // 緑フォスファースタイル
      const rVal = (intensity * 60) | 0;
      const g = (intensity * 255) | 0;
      const bVal = (intensity * 30) | 0;
      const a = Math.min(255, (intensity * 400) | 0);

      // カラムに対応するピクセル幅を全て埋める
      for (let px = pxStart; px < pxEnd; px++) {
        const oi = (py * w + px) * 4;
        out[oi] = Math.max(out[oi], rVal);
        out[oi + 1] = Math.max(out[oi + 1], g);
        out[oi + 2] = Math.max(out[oi + 2], bVal);
        out[oi + 3] = Math.max(out[oi + 3], a);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // グリッドを再描画（密度マップの上に）
  ctx.strokeStyle = 'rgba(80, 80, 80, 0.4)';
  ctx.lineWidth = 0.5;
  for (const pct of [0, 0.25, 0.5, 0.75, 1.0]) {
    const y = h - pct * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // IRE ラベル
  ctx.fillStyle = 'rgba(120, 120, 120, 0.6)';
  ctx.font = '9px monospace';
  ctx.textBaseline = 'bottom';
  for (const [pct, label] of [[1.0, '100'], [0.5, '50'], [0, '0']] as const) {
    const y = h - pct * h;
    ctx.fillText(label, 2, y - 1);
  }
}

export const WaveformMonitor: React.FC<WaveformMonitorProps> = ({
  data,
  width = 196,
  height = 128,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawWaveform(ctx, data, width, height);
  }, [data, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        width: '100%',
        height: `${height}px`,
        borderRadius: '4px',
        border: '1px solid #3a3a3a',
      }}
    />
  );
};
