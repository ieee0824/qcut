import { useRef, useCallback, useEffect, useMemo } from 'react';
import type { ClipEffects } from '../../store/timelineStore';
import { DEFAULT_EFFECTS, DEFAULT_TONE_CURVES } from '../../store/timelineStore';
import type { WebGLPipeline } from './canvasEffects';
import { needsCanvasPipeline, initWebGLPipeline, renderFrame, destroyPipeline } from './canvasEffects';
import type { Clip as ClipType } from '../../store/timelineStore';
import { getEffectsAtTime, hasActiveKeyframes } from '../../utils/keyframes';
import { getToneCurvesAtTime, hasActiveToneCurveKeyframes } from '../../utils/toneCurveKeyframes';
import { logAction } from '../../store/actionLogger';
import { useVideoPreviewStore } from '../../store/videoPreviewStore';

interface UseCanvasRendererParams {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  currentClip: ClipType | null;
  currentTimeRef: React.MutableRefObject<number>;
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
  currentTimeRef,
}: UseCanvasRendererParams): UseCanvasRendererReturn => {
  const pipelineRef = useRef<ReturnType<typeof initWebGLPipeline>>(null);
  const debugFrameCountRef = useRef(0);

  // キーフレームマーカードラッグ中の一時的なプレビュー時刻
  const kfDragPreviewTime = useVideoPreviewStore((s) => s.kfDragPreviewTime);
  const kfDragPreviewTimeRef = useRef(kfDragPreviewTime);
  kfDragPreviewTimeRef.current = kfDragPreviewTime;

  // ベースエフェクト（キーフレームなし時）で WebGL の必要性を判定
  const baseEffects: ClipEffects = useMemo(
    () => ({ ...DEFAULT_EFFECTS, ...currentClip?.effects }),
    [currentClip?.effects],
  );
  const baseToneCurves = useMemo(
    () => currentClip?.toneCurves ?? DEFAULT_TONE_CURVES,
    [currentClip?.toneCurves],
  );
  // キーフレームがある場合は常に canvas を使用（保守的）
  const needsCanvas = needsCanvasPipeline(baseEffects, baseToneCurves)
    || (currentClip ? hasActiveKeyframes(currentClip) : false)
    || (currentClip ? hasActiveToneCurveKeyframes(currentClip.toneCurveKeyframes) : false);

  // renderCanvasFrame 内で最新の currentClip / needsCanvas を参照するための ref
  const currentClipRef = useRef(currentClip);
  currentClipRef.current = currentClip;
  const needsCanvasRef = useRef(needsCanvas);
  needsCanvasRef.current = needsCanvas;

  const renderCanvasFrame = useCallback(() => {
    if (!needsCanvasRef.current) {
      return;
    }
    if (!videoRef.current || !canvasRef.current) return;

    const clip = currentClipRef.current;
    if (!clip) {
      logAction('renderCanvasFrame', 'SKIP: clip=null');
      return;
    }

    // キーフレームがある場合は現在時刻で補間、なければベースエフェクトを使用
    let effects: ClipEffects;
    const activeKf = hasActiveKeyframes(clip);
    if (activeKf) {
      const timelineTime = kfDragPreviewTimeRef.current ?? currentTimeRef.current;
      const clipLocalTime = timelineTime - clip.startTime;
      effects = getEffectsAtTime(clip, clipLocalTime);

      // 60フレームに1回ログ
      debugFrameCountRef.current = (debugFrameCountRef.current + 1) % 60;
      if (debugFrameCountRef.current === 0) {
        const kfKeys = Object.keys(clip.keyframes ?? {}).join(',');
        const tc = currentClipRef.current?.toneCurves ?? DEFAULT_TONE_CURVES;
        logAction('renderCanvasFrame', `t=${clipLocalTime.toFixed(2)} kfKeys=${kfKeys} brightness=${effects.brightness?.toFixed(3)} contrast=${effects.contrast?.toFixed(3)} needsCanvasPipeline=${needsCanvasPipeline(effects, tc)}`);
      }
    } else {
      effects = { ...DEFAULT_EFFECTS, ...clip.effects };
    }

    // キーフレームがアクティブな場合、canvas がビデオを隠しているため
    // WebGL 専用エフェクトがなくても必ず描画する（早期リターンしない）
    const activeTcKf = hasActiveToneCurveKeyframes(currentClipRef.current?.toneCurveKeyframes);
    if (!needsCanvasPipeline(effects, currentClipRef.current?.toneCurves ?? DEFAULT_TONE_CURVES) && !activeKf && !activeTcKf) {
      return;
    }

    // Lazy init pipeline
    if (!pipelineRef.current) {
      pipelineRef.current = initWebGLPipeline(canvasRef.current);
    }
    if (!pipelineRef.current) return;

    const tc = currentClipRef.current?.toneCurves ?? DEFAULT_TONE_CURVES;

    // トーンカーブキーフレームがアクティブなら補間済み LUT を使用
    const tcKfs = currentClipRef.current?.toneCurveKeyframes;
    let precomputedLUTs: { rgbLUT: Float32Array; rLUT: Float32Array; gLUT: Float32Array; bLUT: Float32Array } | undefined;
    if (hasActiveToneCurveKeyframes(tcKfs)) {
      const timelineTime = kfDragPreviewTimeRef.current ?? currentTimeRef.current;
      const clipLocalTime = timelineTime - (currentClipRef.current?.startTime ?? 0);
      const interpolated = getToneCurvesAtTime(tcKfs!, clipLocalTime);
      if (interpolated) {
        precomputedLUTs = interpolated;
      }
    }

    renderFrame(pipelineRef.current, videoRef.current, effects, precomputedLUTs ? undefined : tc, precomputedLUTs);
  }, [videoRef, canvasRef, currentTimeRef]);

  // Re-render when effects change while paused (clip の変更にも追従)
  useEffect(() => {
    if (!needsCanvas || !currentClip) return;
    renderCanvasFrame();
    // Video src が切り替わり readyState=0 の場合、loadeddata を待って再描画
    const video = videoRef.current;
    if (video && video.readyState < 2) {
      const retry = () => renderCanvasFrame();
      video.addEventListener('loadeddata', retry, { once: true });
      return () => video.removeEventListener('loadeddata', retry);
    }
  }, [needsCanvas, renderCanvasFrame, currentClip, videoRef]);

  // キーフレームマーカードラッグ中のリアルタイムプレビュー
  useEffect(() => {
    if (kfDragPreviewTime === null || !needsCanvas) return;
    renderCanvasFrame();
  }, [kfDragPreviewTime, needsCanvas, renderCanvasFrame]);

  // Video ready / seek完了時に canvas を再描画
  // WebKit では loadeddata 時点で useVideoSwitching の seek が未完了の場合があり、
  // ct=0 の黒フレームを描画してしまう。seeked イベントと遅延再描画で対策する。
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !needsCanvas) return;

    const SEEK_SETTLE_DELAY_MS = 150;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // 既に ready なら即描画
    if (video.readyState >= 2) {
      renderCanvasFrame();
    }

    const onReady = () => {
      renderCanvasFrame();
      // seek 未完了の場合のみ遅延再描画をスケジュール
      if (video.seeking) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          renderCanvasFrame();
          timer = null;
        }, SEEK_SETTLE_DELAY_MS);
      }
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
