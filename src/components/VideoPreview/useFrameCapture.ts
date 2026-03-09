import { useRef, useCallback, useEffect } from 'react';
import type { WebGLPipeline } from './canvasEffects';
import { readPixels } from './canvasEffects';
import { computeHistogram, computeVectorscope, computeWaveform } from '../../utils/scopeAnalysis';
import { useScopeStore } from '../../store/scopeStore';
import type { ClipEffects } from '../../store/timelineStore';

interface UseFrameCaptureParams {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  pipelineRef: React.RefObject<WebGLPipeline | null>;
  needsCanvas: boolean;
  effects: ClipEffects | undefined;
}

const FRAME_SKIP = 3;
// スコープ解析用の縮小サイズ（転送ピクセル数を大幅に削減）
const SCOPE_WIDTH = 160;
const SCOPE_HEIGHT = 90;

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
  const offscreenInitRef = useRef(false);

  const capture = useCallback(() => {
    if (!useScopeStore.getState().enabled) return;

    let pixels: Uint8ClampedArray | Uint8Array | null = null;
    let pixelWidth = SCOPE_WIDTH;

    if (needsCanvas && pipelineRef.current) {
      pixels = readPixels(pipelineRef.current);
      const glCanvas = pipelineRef.current.gl.canvas as HTMLCanvasElement;
      pixelWidth = glCanvas.width;
    } else if (videoRef.current && videoRef.current.readyState >= 2) {
      const video = videoRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
      }
      const canvas = offscreenCanvasRef.current;
      // 固定小サイズに縮小描画して転送ピクセル数を削減
      if (!offscreenInitRef.current) {
        canvas.width = SCOPE_WIDTH;
        canvas.height = SCOPE_HEIGHT;
        offscreenInitRef.current = true;
      }
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, SCOPE_WIDTH, SCOPE_HEIGHT);
      pixels = ctx.getImageData(0, 0, SCOPE_WIDTH, SCOPE_HEIGHT).data;
    }

    if (!pixels) return;

    const state = useScopeStore.getState();
    const active = state.activeScopes;

    if (active.has('histogram')) {
      state.setHistogramData(computeHistogram(pixels, 1));
    }
    if (active.has('vectorscope')) {
      state.setVectorscopeData(computeVectorscope(pixels, 1));
    }
    if (active.has('waveform')) {
      state.setWaveformData(computeWaveform(pixels, pixelWidth, 1));
    }
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
