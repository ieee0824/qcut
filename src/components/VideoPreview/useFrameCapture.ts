import { useRef, useCallback, useEffect } from 'react';
import type { WebGLPipeline } from './canvasEffects';
import { readPixels } from './canvasEffects';
import { computeHistogram } from '../../utils/scopeAnalysis';
import { useScopeStore } from '../../store/scopeStore';
import type { ClipEffects } from '../../store/timelineStore';

interface UseFrameCaptureParams {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  pipelineRef: React.RefObject<WebGLPipeline | null>;
  needsCanvas: boolean;
  effects: ClipEffects | undefined;
}

const FRAME_SKIP = 3;

/**
 * 映像フレームからピクセルデータを取得し、スコープ解析を行うフック。
 * 再生ループの各フレームで captureFrame() を呼び出す。
 * パフォーマンスのため FRAME_SKIP フレームに1回だけ解析する。
 * エフェクト変更時は即座にキャプチャする。
 */
export const useFrameCapture = ({
  videoRef,
  pipelineRef,
  needsCanvas,
  effects,
}: UseFrameCaptureParams) => {
  const frameCountRef = useRef(0);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const capture = useCallback(() => {
    if (!useScopeStore.getState().enabled) return;

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

  // 再生ループ用（フレームスキップあり）
  const captureFrame = useCallback(() => {
    frameCountRef.current++;
    if (frameCountRef.current % FRAME_SKIP !== 0) return;
    capture();
  }, [capture]);

  // エフェクト変更時に即座にキャプチャ
  useEffect(() => {
    capture();
  }, [effects, capture]);

  return { captureFrame };
};
