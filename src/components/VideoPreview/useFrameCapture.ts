import { useRef, useCallback } from 'react';
import type { WebGLPipeline } from './canvasEffects';
import { readPixels } from './canvasEffects';
import { computeHistogram } from '../../utils/scopeAnalysis';
import { useScopeStore } from '../../store/scopeStore';

interface UseFrameCaptureParams {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  pipelineRef: React.RefObject<WebGLPipeline | null>;
  needsCanvas: boolean;
}

const FRAME_SKIP = 3;

/**
 * 映像フレームからピクセルデータを取得し、スコープ解析を行うフック。
 * 再生ループの各フレームで captureFrame() を呼び出す。
 * パフォーマンスのため FRAME_SKIP フレームに1回だけ解析する。
 */
export const useFrameCapture = ({
  videoRef,
  pipelineRef,
  needsCanvas,
}: UseFrameCaptureParams) => {
  const frameCountRef = useRef(0);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const captureFrame = useCallback(() => {
    if (!useScopeStore.getState().enabled) return;

    frameCountRef.current++;
    if (frameCountRef.current % FRAME_SKIP !== 0) return;

    let pixels: Uint8ClampedArray | Uint8Array | null = null;

    if (needsCanvas && pipelineRef.current) {
      pixels = readPixels(pipelineRef.current);
    } else if (videoRef.current && videoRef.current.readyState >= 2) {
      const video = videoRef.current;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w === 0 || h === 0) return;

      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
      }
      const canvas = offscreenCanvasRef.current;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      pixels = ctx.getImageData(0, 0, w, h).data;
    }

    if (!pixels) return;

    const histogram = computeHistogram(pixels, 4);
    useScopeStore.getState().setHistogramData(histogram);
  }, [videoRef, pipelineRef, needsCanvas]);

  return { captureFrame };
};
