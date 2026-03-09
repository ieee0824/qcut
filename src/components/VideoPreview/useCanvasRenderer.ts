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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pipelineRef.current) {
        destroyPipeline(pipelineRef.current);
        pipelineRef.current = null;
      }
    };
  }, []);

  // Destroy pipeline when no longer needed
  useEffect(() => {
    if (!needsCanvas && pipelineRef.current) {
      destroyPipeline(pipelineRef.current);
      pipelineRef.current = null;
    }
  }, [needsCanvas]);

  return { needsCanvas, renderCanvasFrame, pipelineRef };
};
