import { useRef, useEffect } from 'react';
import { useWaveformStore } from '../../store/waveformStore';

interface WaveformCanvasProps {
  filePath: string;
  sourceStartTime: number;
  sourceEndTime: number;
  width: number;
  height: number;
  color?: string;
}

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({ filePath, sourceStartTime, sourceEndTime, width, height, color = '#a0cfff' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformData = useWaveformStore((s) => s.waveforms[filePath]);
  const fetchWaveform = useWaveformStore((s) => s.fetchWaveform);

  useEffect(() => {
    if (filePath) {
      fetchWaveform(filePath);
    }
  }, [filePath, fetchWaveform]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveformData || width <= 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const { peaks, sampleRate } = waveformData;
    const startIndex = Math.floor(sourceStartTime * sampleRate);
    const endIndex = Math.ceil(sourceEndTime * sampleRate);
    const slicedPeaks = peaks.slice(startIndex, endIndex);

    if (slicedPeaks.length === 0) return;

    const centerY = height / 2;
    ctx.fillStyle = color;

    const peaksPerPixel = slicedPeaks.length / width;

    for (let x = 0; x < width; x++) {
      const fromIdx = Math.floor(x * peaksPerPixel);
      const toIdx = Math.min(Math.floor((x + 1) * peaksPerPixel), slicedPeaks.length);

      let min = 0;
      let max = 0;
      for (let j = fromIdx; j < toIdx; j++) {
        if (slicedPeaks[j][0] < min) min = slicedPeaks[j][0];
        if (slicedPeaks[j][1] > max) max = slicedPeaks[j][1];
      }

      const top = centerY - max * centerY;
      const bottom = centerY - min * centerY;
      const barHeight = Math.max(1, bottom - top);

      ctx.fillRect(x, top, 1, barHeight);
    }
  }, [waveformData, sourceStartTime, sourceEndTime, width, height, color]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
      }}
    />
  );
};
