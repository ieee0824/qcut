/* eslint-disable no-undef */
import React, { useRef, useEffect } from 'react';
import type { HistogramData } from '../../utils/scopeAnalysis';

interface HistogramProps {
  data: HistogramData | null;
  width?: number;
  height?: number;
}

function drawHistogram(
  ctx: CanvasRenderingContext2D,
  data: HistogramData,
  w: number,
  h: number,
) {
  ctx.clearRect(0, 0, w, h);

  // 背景
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, w, h);

  // 各チャンネルの最大値を求めてスケーリング
  let max = 1;
  for (let i = 0; i < 256; i++) {
    if (data.r[i] > max) max = data.r[i];
    if (data.g[i] > max) max = data.g[i];
    if (data.b[i] > max) max = data.b[i];
  }

  const channels: { arr: Uint32Array; color: string }[] = [
    { arr: data.r, color: 'rgba(255, 0, 0, 0.5)' },
    { arr: data.g, color: 'rgba(0, 255, 0, 0.5)' },
    { arr: data.b, color: 'rgba(0, 100, 255, 0.5)' },
  ];

  const binWidth = w / 256;

  for (const ch of channels) {
    ctx.fillStyle = ch.color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < 256; i++) {
      const barH = (ch.arr[i] / max) * h;
      ctx.lineTo(i * binWidth, h - barH);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }

  // 輝度（白ライン）
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  let lumaMax = 1;
  for (let i = 0; i < 256; i++) {
    if (data.luma[i] > lumaMax) lumaMax = data.luma[i];
  }
  ctx.beginPath();
  for (let i = 0; i < 256; i++) {
    const y = h - (data.luma[i] / lumaMax) * h;
    if (i === 0) ctx.moveTo(0, y);
    else ctx.lineTo(i * binWidth, y);
  }
  ctx.stroke();
}

export const Histogram: React.FC<HistogramProps> = ({
  data,
  width = 196,
  height = 100,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawHistogram(ctx, data, width, height);
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
