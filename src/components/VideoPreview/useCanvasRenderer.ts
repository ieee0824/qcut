import { useRef, useCallback, useEffect, useMemo } from 'react';
import type { ClipEffects } from '../../store/timelineStore';
import { DEFAULT_EFFECTS } from '../../store/timelineStore';
import type { WebGLPipeline } from './canvasEffects';
import { needsCanvasPipeline, initWebGLPipeline, renderFrame, destroyPipeline } from './canvasEffects';
import type { Clip as ClipType } from '../../store/timelineStore';

interface UseCanvasRendererParams {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  currentClip: ClipType | null;
}

interface UseCanvasRendererReturn {
  needsCanvas: boolean;
  renderCanvasFrame: () => void;
  pipelineRef: React.RefObject<WebGLPipeline | null>;
}

export const useCanvasRenderer = ({
  videoRef,
  canvasRef,
  currentClip,
}: UseCanvasRendererParams): UseCanvasRendererReturn => {
  const pipelineRef = useRef<ReturnType<typeof initWebGLPipeline>>(null);

  const effects: ClipEffects = useMemo(
    () => ({ ...DEFAULT_EFFECTS, ...currentClip?.effects }),
    [currentClip?.effects],
  );
  const needsCanvas = needsCanvasPipeline(effects);

  const renderCanvasFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    if (!needsCanvas) return;

    // Lazy init pipeline
    if (!pipelineRef.current) {
      pipelineRef.current = initWebGLPipeline(canvasRef.current);
    }
    if (!pipelineRef.current) return;

    renderFrame(pipelineRef.current, videoRef.current, effects);
  }, [videoRef, canvasRef, needsCanvas, effects]);

  // Re-render when effects change while paused
  useEffect(() => {
    if (needsCanvas) {
      renderCanvasFrame();
    }
  }, [needsCanvas, renderCanvasFrame]);

  // Video ready / seek完了時に canvas を再描画
  // WebKit では loadeddata 時点で useVideoSwitching の seek が未完了の場合があり、
  // ct=0 の黒フレームを描画してしまう。seeked イベントと遅延再描画で対策する。
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !needsCanvas) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    // 既に ready なら即描画
    if (video.readyState >= 2) {
      renderCanvasFrame();
    }

    const onReady = () => {
      renderCanvasFrame();
      // loadeddata 後に seek が完了するまでの遅延再描画
      timer = setTimeout(() => renderCanvasFrame(), 150);
    };
    const onSeeked = () => {
      if (video.readyState >= 2) {
        renderCanvasFrame();
      }
    };
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('seeked', onSeeked);
    return () => {
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('seeked', onSeeked);
      if (timer) clearTimeout(timer);
    };
  }, [videoRef, needsCanvas, renderCanvasFrame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pipelineRef.current) {
        destroyPipeline(pipelineRef.current);
        pipelineRef.current = null;
      }
    };
  }, []);

  // パイプラインは needsCanvas が false になっても破棄しない。
  // loseContext() 後に同じ canvas で再初期化するとシェーダー作成に失敗するため、
  // アンマウント時のみ破棄する。

  return { needsCanvas, renderCanvasFrame, pipelineRef };
};
