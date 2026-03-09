/* eslint-disable no-undef */
import React, { useRef, useEffect } from 'react';
import type { VectorscopeData } from '../../utils/scopeAnalysis';

interface VectorscopeProps {
  data: VectorscopeData | null;
  size?: number;
}

// 色ターゲット位置（BT.709 Cb/Cr 座標、0-255スケール）
const COLOR_TARGETS: { label: string; cb: number; cr: number; color: string }[] = [
  { label: 'R', cb: 100, cr: 212, color: '#ff4444' },
  { label: 'G', cb: 72, cr: 58, color: '#44ff44' },
  { label: 'B', cb: 184, cr: 114, color: '#4444ff' },
  { label: 'C', cb: 156, cr: 44, color: '#44ffff' },
  { label: 'M', cb: 184, cr: 198, color: '#ff44ff' },
  { label: 'Y', cb: 72, cr: 142, color: '#ffff44' },
];

// スキントーンライン角度（Cb=128, Cr=128 の原点からの角度）
// 約 123度（Cb方向が+X、Cr方向が+Y として）
const SKIN_TONE_ANGLE = (123 * Math.PI) / 180;

function drawVectorscope(
  ctx: CanvasRenderingContext2D,
  data: VectorscopeData,
  size: number,
) {
  ctx.clearRect(0, 0, size, size);

  // 背景
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const scale = size / 256;

  // グラティキュール（同心円ガイド）
  ctx.strokeStyle = 'rgba(80, 80, 80, 0.4)';
  ctx.lineWidth = 0.5;
  for (const r of [0.25, 0.5, 0.75, 1.0]) {
    ctx.beginPath();
    ctx.arc(cx, cy, (r * size) / 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 十字線
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, size);
  ctx.moveTo(0, cy);
  ctx.lineTo(size, cy);
  ctx.stroke();

  // スキントーンライン
  ctx.strokeStyle = 'rgba(255, 200, 100, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  const skinLen = size * 0.45;
  ctx.lineTo(
    cx + Math.cos(SKIN_TONE_ANGLE) * skinLen,
    cy - Math.sin(SKIN_TONE_ANGLE) * skinLen,
  );
  ctx.stroke();

  // 色ターゲット
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const t of COLOR_TARGETS) {
    const x = t.cb * scale;
    const y = (255 - t.cr) * scale; // Crは上が正
    ctx.strokeStyle = t.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = t.color;
    ctx.fillText(t.label, x, y - 8);
  }

  // 密度マップ描画
  if (data.peak === 0) return;

  const imageData = ctx.createImageData(size, size);
  const out = imageData.data;
  const logPeak = Math.log(data.peak + 1);

  for (let cr = 0; cr < 256; cr++) {
    for (let cb = 0; cb < 256; cb++) {
      const count = data.density[cr * 256 + cb];
      if (count === 0) continue;

      // 対数スケールで正規化
      const intensity = Math.log(count + 1) / logPeak;

      // 画面座標に変換
      const px = (cb * scale) | 0;
      const py = ((255 - cr) * scale) | 0;

      if (px >= size || py >= size) continue;

      const oi = (py * size + px) * 4;
      // 緑のフォスファースタイル
      const g = (intensity * 255) | 0;
      out[oi] = (intensity * 80) | 0;
      out[oi + 1] = Math.max(out[oi + 1], g);
      out[oi + 2] = (intensity * 40) | 0;
      out[oi + 3] = Math.max(out[oi + 3], Math.min(255, (intensity * 400) | 0));
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // グラティキュールをもう一度（密度マップの上に）
  ctx.strokeStyle = 'rgba(80, 80, 80, 0.4)';
  ctx.lineWidth = 0.5;
  for (const r of [0.25, 0.5, 0.75, 1.0]) {
    ctx.beginPath();
    ctx.arc(cx, cy, (r * size) / 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, size);
  ctx.moveTo(0, cy);
  ctx.lineTo(size, cy);
  ctx.stroke();

  // スキントーンライン
  ctx.strokeStyle = 'rgba(255, 200, 100, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(
    cx + Math.cos(SKIN_TONE_ANGLE) * skinLen,
    cy - Math.sin(SKIN_TONE_ANGLE) * skinLen,
  );
  ctx.stroke();

  // 色ターゲット
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const t of COLOR_TARGETS) {
    const x = t.cb * scale;
    const y = (255 - t.cr) * scale;
    ctx.strokeStyle = t.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = t.color;
    ctx.fillText(t.label, x, y - 8);
  }
}

export const Vectorscope: React.FC<VectorscopeProps> = ({
  data,
  size = 196,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawVectorscope(ctx, data, size);
  }, [data, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{
        width: '100%',
        aspectRatio: '1',
        borderRadius: '4px',
        border: '1px solid #3a3a3a',
      }}
    />
  );
};
