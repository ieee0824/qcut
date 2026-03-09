/* eslint-disable no-undef */
import React, { useRef, useCallback, useEffect } from 'react';

interface ColorWheelProps {
  label: string;
  r: number;
  g: number;
  b: number;
  onChange: (r: number, g: number, b: number) => void;
  size?: number;
}

const WHEEL_RADIUS_RATIO = 0.42;
const HANDLE_RADIUS = 5;

function drawWheel(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
  const imageData = ctx.createImageData(ctx.canvas.width, ctx.canvas.height);
  const data = imageData.data;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        const angle = Math.atan2(dy, dx);
        const hue = ((angle * 180) / Math.PI + 360) % 360;
        const sat = dist / radius;

        const c = (1 - Math.abs(2 * 0.5 - 1)) * sat;
        const hPrime = hue / 60;
        const xVal = c * (1 - Math.abs((hPrime % 2) - 1));
        let r1 = 0, g1 = 0, b1 = 0;
        if (hPrime < 1) { r1 = c; g1 = xVal; }
        else if (hPrime < 2) { r1 = xVal; g1 = c; }
        else if (hPrime < 3) { g1 = c; b1 = xVal; }
        else if (hPrime < 4) { g1 = xVal; b1 = c; }
        else if (hPrime < 5) { r1 = xVal; b1 = c; }
        else { r1 = c; b1 = xVal; }

        const m = 0.5 - c / 2;
        const idx = (y * w + x) * 4;
        data[idx] = Math.round((r1 + m) * 255);
        data[idx + 1] = Math.round((g1 + m) * 255);
        data[idx + 2] = Math.round((b1 + m) * 255);
        data[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // Draw outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawHandle(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath();
  ctx.arc(x, y, HANDLE_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export const ColorWheel: React.FC<ColorWheelProps> = ({
  label,
  r,
  g,
  b,
  onChange,
  size = 100,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef(false);
  const wheelImageRef = useRef<ImageData | null>(null);

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * WHEEL_RADIUS_RATIO;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, size, size);

    // Cache wheel image
    if (!wheelImageRef.current || wheelImageRef.current.width !== size) {
      drawWheel(ctx, cx, cy, radius);
      wheelImageRef.current = ctx.getImageData(0, 0, size, size);
    } else {
      ctx.putImageData(wheelImageRef.current, 0, 0);
    }

    // Draw crosshair at center
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy);
    ctx.lineTo(cx + 4, cy);
    ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx, cy + 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw handle
    const hx = cx + r * radius;
    const hy = cy - g * radius;
    drawHandle(ctx, hx, hy);
  }, [size, cx, cy, radius, r, g]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const posToValues = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { r: 0, g: 0, b: 0 };
      const rect = canvas.getBoundingClientRect();
      let dx = clientX - rect.left - cx;
      let dy = clientY - rect.top - cy;

      // Clamp to wheel radius
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) {
        dx = (dx / dist) * radius;
        dy = (dy / dist) * radius;
      }

      const newR = dx / radius;
      const newG = -dy / radius;
      // B is derived: opposite of the dominant warm axis
      const newB = -newR;

      return {
        r: Math.round(newR * 100) / 100,
        g: Math.round(newG * 100) / 100,
        b: Math.round(newB * 100) / 100,
      };
    },
    [cx, cy, radius],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      isDraggingRef.current = true;
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      const vals = posToValues(e.clientX, e.clientY);
      onChange(vals.r, vals.g, vals.b);
    },
    [posToValues, onChange],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return;
      const vals = posToValues(e.clientX, e.clientY);
      onChange(vals.r, vals.g, vals.b);
    },
    [posToValues, onChange],
  );

  const handlePointerUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleDoubleClick = useCallback(() => {
    onChange(0, 0, 0);
  }, [onChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <span style={{ fontSize: '11px', color: '#aaa' }}>{label}</span>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{ cursor: 'crosshair', borderRadius: '50%' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      />
      <div style={{ fontSize: '10px', color: '#777', display: 'flex', gap: '6px' }}>
        <span style={{ color: '#f66' }}>R:{r.toFixed(2)}</span>
        <span style={{ color: '#6f6' }}>G:{g.toFixed(2)}</span>
        <span style={{ color: '#66f' }}>B:{b.toFixed(2)}</span>
      </div>
    </div>
  );
};
