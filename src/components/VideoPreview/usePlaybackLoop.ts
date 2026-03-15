import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { useVideoPreviewStore } from '../../store/videoPreviewStore';
import { useTimelineStore, DEFAULT_EFFECTS } from '../../store/timelineStore';
import type { Clip as ClipType, TransitionType } from '../../store/timelineStore';
import type { TransitionInfo } from './useTransitionEffect';
import { audioEngine } from '../../audio/AudioEngine';
import { getEffectsAtTime, hasActiveKeyframes } from '../../utils/keyframes';

const VIDEO_AUDIO_ID = '__video_main__';

interface UsePlaybackLoopParams {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  currentTimeRef: React.MutableRefObject<number>;
  transitionVideoRef: React.RefObject<HTMLVideoElement | null>;
  loadedVideoUrl: React.MutableRefObject<string | null>;
  loadedTransitionVideoUrl: React.MutableRefObject<string | null>;
  isLoadingVideoRef: React.MutableRefObject<boolean>;
  isLoadingTransitionVideoRef: React.MutableRefObject<boolean>;
  isInTransitionRef: React.MutableRefObject<boolean>;
  switchVideo: (url: string, sourceTime: number, autoPlay: boolean) => void;
  switchTransitionVideo: (url: string, sourceTime: number) => void;
  findClipAtTime: (time: number) => ClipType | null;
  findNextClipAfter: (time: number) => ClipType | null;
  findTransitionAtTime: (time: number) => TransitionInfo | null;
  getTransitionStyles: (
    progress: number,
    type: TransitionType,
  ) => { outgoing: React.CSSProperties; incoming: React.CSSProperties };
  renderCanvasFrame?: () => void;
  captureFrame?: () => void;
}

interface UsePlaybackLoopReturn {
  timeDisplayRef: React.RefObject<globalThis.HTMLSpanElement | null>;
  seekBarRef: React.RefObject<HTMLInputElement | null>;
  formatTime: (seconds: number) => string;
  updateTimeDisplay: (time: number) => void;
  startPlaybackLoop: () => void;
  stopPlaybackLoop: () => void;
}

export function getMonotonicPlaybackTime(previousTime: number, nextTime: number): number {
  return nextTime < previousTime ? previousTime : nextTime;
}

interface PlaybackTimelineTimeParams {
  previousTimelineTime: number;
  clipStartTime: number;
  clipSourceStartTime: number;
  videoSourceTime: number;
}

interface TransitionPlaybackPlanParams {
  transition: TransitionInfo;
  currentTime: number;
  videoUrls: Record<string, string>;
  loadedOutgoingUrl: string | null;
  loadedIncomingUrl: string | null;
  isLoadingOutgoing: boolean;
  isLoadingIncoming: boolean;
}

interface TransitionPlaybackPlan {
  outgoingUrl: string | null;
  incomingUrl: string | null;
  outgoingSourceTime: number;
  incomingSourceTime: number;
  shouldSwitchOutgoing: boolean;
  shouldSwitchIncoming: boolean;
}

interface ShouldResyncTransitionVideoParams {
  currentVideoTime: number;
  expectedSourceTime: number;
  paused: boolean;
}

interface ShouldResyncActiveVideoParams {
  currentVideoTime: number;
  expectedSourceTime: number;
  loadedUrlMatches: boolean;
  isLoading: boolean;
}

export function getPlaybackTimelineTime({
  previousTimelineTime,
  clipStartTime,
  clipSourceStartTime,
  videoSourceTime,
}: PlaybackTimelineTimeParams): number {
  const relativeTime = videoSourceTime - clipSourceStartTime;
  const timelineTime = clipStartTime + relativeTime;
  return getMonotonicPlaybackTime(previousTimelineTime, timelineTime);
}

export function getTransitionPlaybackPlan({
  transition,
  currentTime,
  videoUrls,
  loadedOutgoingUrl,
  loadedIncomingUrl,
  isLoadingOutgoing,
  isLoadingIncoming,
}: TransitionPlaybackPlanParams): TransitionPlaybackPlan {
  const { outgoingClip, incomingClip, duration } = transition;
  const outgoingUrl = videoUrls[outgoingClip.filePath] ?? null;
  const incomingUrl = videoUrls[incomingClip.filePath] ?? null;
  const overlapStartTime = incomingClip.startTime - duration;

  const outgoingSourceTime =
    outgoingClip.sourceStartTime + (currentTime - outgoingClip.startTime);
  const incomingSourceTime =
    incomingClip.sourceStartTime + (currentTime - overlapStartTime);

  return {
    outgoingUrl,
    incomingUrl,
    outgoingSourceTime,
    incomingSourceTime,
    shouldSwitchOutgoing:
      Boolean(outgoingUrl) &&
      outgoingUrl !== loadedOutgoingUrl &&
      !isLoadingOutgoing,
    shouldSwitchIncoming:
      Boolean(incomingUrl) &&
      incomingUrl !== loadedIncomingUrl &&
      !isLoadingIncoming,
  };
}

export function shouldCleanupTransitionPlayback(
  wasInTransition: boolean,
  transition: TransitionInfo | null,
): boolean {
  return wasInTransition && transition === null;
}

export function shouldResyncTransitionVideo({
  currentVideoTime,
  expectedSourceTime,
  paused,
}: ShouldResyncTransitionVideoParams): boolean {
  return paused || Math.abs(currentVideoTime - expectedSourceTime) > 0.1;
}

export function shouldResyncActiveVideo({
  currentVideoTime,
  expectedSourceTime,
  loadedUrlMatches,
  isLoading,
}: ShouldResyncActiveVideoParams): boolean {
  if (isLoading || !loadedUrlMatches) {
    return false;
  }
  return Math.abs(currentVideoTime - expectedSourceTime) > 0.1;
}

export const usePlaybackLoop = ({
  videoRef,
  currentTimeRef,
  transitionVideoRef,
  loadedVideoUrl,
  loadedTransitionVideoUrl,
  isLoadingVideoRef,
  isLoadingTransitionVideoRef,
  isInTransitionRef,
  switchVideo,
  switchTransitionVideo,
  findClipAtTime,
  findNextClipAfter,
  findTransitionAtTime,
  getTransitionStyles,
  renderCanvasFrame,
  captureFrame,
}: UsePlaybackLoopParams): UsePlaybackLoopReturn => {
  const playbackRafRef = useRef<number | null>(null);
  const lastTimestampRef = useRef(0);
  const timeDisplayRef = useRef<globalThis.HTMLSpanElement>(null);
  const seekBarRef = useRef<HTMLInputElement>(null);

  const { setIsPlaying } = useVideoPreviewStore();
  const renderCanvasFrameRef = useRef(renderCanvasFrame);
  renderCanvasFrameRef.current = renderCanvasFrame;
  const captureFrameRef = useRef(captureFrame);
  captureFrameRef.current = captureFrame;

  // 時間表示のフォーマット
  const formatTime = useCallback((seconds: number): string => {
    if (!Number.isFinite(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, []);

  // 時間表示とシークバーを DOM 直接更新
  const updateTimeDisplay = useCallback(
    (time: number) => {
      currentTimeRef.current = time;
      if (timeDisplayRef.current) {
        const dur = useVideoPreviewStore.getState().duration;
        timeDisplayRef.current.textContent = `${formatTime(time)} / ${formatTime(dur)}`;
      }
      if (seekBarRef.current) {
        seekBarRef.current.value = String(time);
      }
    },
    [currentTimeRef, formatTime],
  );

  // 再生ループを停止するヘルパー
  const stopPlaybackLoop = useCallback(() => {
    if (playbackRafRef.current !== null) {
      window.cancelAnimationFrame(playbackRafRef.current);
      playbackRafRef.current = null;
    }
  }, []);

  // 統一再生ループ（クリップ中もギャップ中も同一のRAFで駆動）
  const startPlaybackLoop = useCallback(() => {
    stopPlaybackLoop();
    lastTimestampRef.current = globalThis.performance.now();

    const tick = (timestamp: number) => {
      const delta = (timestamp - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = timestamp;

      if (!videoRef.current) {
        playbackRafRef.current = window.requestAnimationFrame(tick);
        return;
      }

      const clip = findClipAtTime(currentTimeRef.current);

      // --- トランジション判定 ---
      const transition = findTransitionAtTime(currentTimeRef.current);
      if (transition && transitionVideoRef.current) {
        isInTransitionRef.current = true;
        const { progress, transitionType } = transition;
        const urls = useVideoPreviewStore.getState().videoUrls;
        const playbackPlan = getTransitionPlaybackPlan({
          transition,
          currentTime: currentTimeRef.current,
          videoUrls: urls,
          loadedOutgoingUrl: loadedVideoUrl.current,
          loadedIncomingUrl: loadedTransitionVideoUrl.current,
          isLoadingOutgoing: isLoadingVideoRef.current,
          isLoadingIncoming: isLoadingTransitionVideoRef.current,
        });

        // outgoing clip → videoRef
        if (playbackPlan.shouldSwitchOutgoing && playbackPlan.outgoingUrl) {
          switchVideo(playbackPlan.outgoingUrl, playbackPlan.outgoingSourceTime, true);
        }

        // incoming clip → transitionVideoRef
        if (
          playbackPlan.incomingUrl &&
          (
            playbackPlan.shouldSwitchIncoming ||
            shouldResyncTransitionVideo({
              currentVideoTime: transitionVideoRef.current.currentTime,
              expectedSourceTime: playbackPlan.incomingSourceTime,
              paused: transitionVideoRef.current.paused,
            })
          )
        ) {
          switchTransitionVideo(playbackPlan.incomingUrl, playbackPlan.incomingSourceTime);
        }

        // CSS スタイルを直接更新（レンダー不要）
        const styles = getTransitionStyles(progress, transitionType);
        videoRef.current.style.opacity =
          styles.outgoing.opacity !== undefined ? String(styles.outgoing.opacity) : '1';
        videoRef.current.style.clipPath =
          (styles.outgoing as Record<string, string>).clipPath || '';
        transitionVideoRef.current.style.visibility = 'visible';
        transitionVideoRef.current.style.opacity =
          styles.incoming.opacity !== undefined ? String(styles.incoming.opacity) : '1';
        transitionVideoRef.current.style.clipPath =
          (styles.incoming as Record<string, string>).clipPath || '';

        // delta で時間を進める
        const newTime = currentTimeRef.current + delta;
        currentTimeRef.current = newTime;
        useTimelineStore.getState().setCurrentTime(newTime);
        updateTimeDisplay(newTime);

        playbackRafRef.current = window.requestAnimationFrame(tick);
        return;
      }

      // トランジション終了時のクリーンアップ
      if (shouldCleanupTransitionPlayback(isInTransitionRef.current, transition)) {
        isInTransitionRef.current = false;
        if (videoRef.current) {
          videoRef.current.style.opacity = '1';
          videoRef.current.style.clipPath = '';
        }
        if (transitionVideoRef.current) {
          transitionVideoRef.current.style.visibility = 'hidden';
          transitionVideoRef.current.style.opacity = '1';
          transitionVideoRef.current.style.clipPath = '';
          transitionVideoRef.current.pause();
        }
        // incoming clip に videoRef を切り替え
        if (clip) {
          const url = useVideoPreviewStore.getState().videoUrls[clip.filePath];
          const sourceTime = clip.sourceStartTime + (currentTimeRef.current - clip.startTime);
          if (
            url &&
            (
              url !== loadedVideoUrl.current ||
              shouldResyncActiveVideo({
                currentVideoTime: videoRef.current?.currentTime ?? 0,
                expectedSourceTime: sourceTime,
                loadedUrlMatches: url === loadedVideoUrl.current,
                isLoading: isLoadingVideoRef.current,
              })
            )
          ) {
            switchVideo(url, sourceTime, true);
          }
        }
      }

      if (clip) {
        // --- クリップ区間 ---
        const url = useVideoPreviewStore.getState().videoUrls[clip.filePath];

        if (isLoadingVideoRef.current) {
          const newTime = currentTimeRef.current + delta;
          const clipEnd = clip.startTime + clip.duration;
          if (newTime >= clipEnd) {
            currentTimeRef.current = clipEnd;
          } else {
            currentTimeRef.current = newTime;
          }
          useTimelineStore.getState().setCurrentTime(currentTimeRef.current);
          updateTimeDisplay(currentTimeRef.current);
          playbackRafRef.current = window.requestAnimationFrame(tick);
          return;
        }

        // 正しい動画がロードされていなければ切り替え
        if (url && url !== loadedVideoUrl.current) {
          const sourceTime = clip.sourceStartTime + (currentTimeRef.current - clip.startTime);
          switchVideo(url, sourceTime, true);
          playbackRafRef.current = window.requestAnimationFrame(tick);
          return;
        }

        // 動画が一時停止していれば再開
        if (videoRef.current.paused && url) {
          const sourceTime = clip.sourceStartTime + (currentTimeRef.current - clip.startTime);
          videoRef.current.currentTime = sourceTime;
          videoRef.current.play();
        }

        // 動画の実時間からタイムライン時間を算出
        const videoSourceTime = videoRef.current.currentTime;
        if (videoSourceTime < clip.sourceStartTime - 0.15) {
          const newTime = currentTimeRef.current + delta;
          useTimelineStore.getState().setCurrentTime(newTime);
          updateTimeDisplay(newTime);
          playbackRafRef.current = window.requestAnimationFrame(tick);
          return;
        }

        const safeTimelineTime = getPlaybackTimelineTime({
          previousTimelineTime: currentTimeRef.current,
          clipStartTime: clip.startTime,
          clipSourceStartTime: clip.sourceStartTime,
          videoSourceTime,
        });
        const clipEndTime = clip.startTime + clip.duration;

        if (safeTimelineTime >= clipEndTime || videoSourceTime >= clip.sourceEndTime) {
          currentTimeRef.current = clipEndTime;
          useTimelineStore.getState().setCurrentTime(clipEndTime);
          updateTimeDisplay(clipEndTime);

          const adjacentClip = findClipAtTime(clipEndTime + 0.01);
          if (adjacentClip) {
            const isContinuous =
              adjacentClip.filePath === clip.filePath &&
              Math.abs(adjacentClip.sourceStartTime - clip.sourceEndTime) < 0.05;
            if (!isContinuous) {
              const adjUrl = useVideoPreviewStore.getState().videoUrls[adjacentClip.filePath];
              if (adjUrl) {
                switchVideo(adjUrl, adjacentClip.sourceStartTime, true);
              }
            }
          } else {
            videoRef.current.pause();
          }
        } else {
          currentTimeRef.current = safeTimelineTime;
          useTimelineStore.getState().setCurrentTime(safeTimelineTime);
          updateTimeDisplay(safeTimelineTime);
        }

        // フェードイン/フェードアウトのopacity適用
        if (videoRef.current) {
          const fadeIn = clip.effects?.fadeIn ?? 0;
          const fadeOut = clip.effects?.fadeOut ?? 0;
          if (fadeIn > 0 || fadeOut > 0) {
            const elapsed = currentTimeRef.current - clip.startTime;
            const remaining = clipEndTime - currentTimeRef.current;
            let opacity = 1;
            if (fadeIn > 0 && elapsed < fadeIn) {
              opacity = Math.min(opacity, elapsed / fadeIn);
            }
            if (fadeOut > 0 && remaining < fadeOut) {
              opacity = Math.min(opacity, remaining / fadeOut);
            }
            videoRef.current.style.opacity = String(Math.max(0, Math.min(1, opacity)));
          } else if (!isInTransitionRef.current) {
            videoRef.current.style.opacity = '1';
          }

          // Web Audio API 経由で音声エフェクトを適用
          const clipVolume = clip.effects?.volume ?? 1.0;
          const uiVolume = useVideoPreviewStore.getState().volume / 100;

          // トラックレベルの音量・ミュート・ソロを取得
          const allTracks = useTimelineStore.getState().tracks;
          const videoTrack = allTracks.find(t => t.type === 'video' && t.clips.some(c => c.id === clip.id));
          const hasSolo = allTracks.some(t => t.solo);
          const isTrackMuted = videoTrack ? (videoTrack.mute || (hasSolo && !videoTrack.solo)) : false;
          const trackVol = videoTrack?.volume ?? 1.0;

          // AudioEngine に video 要素を接続（初回のみ）
          if (!audioEngine.hasGraph(VIDEO_AUDIO_ID)) {
            audioEngine.connect(VIDEO_AUDIO_ID, videoRef.current);
          }

          let combinedVolume: number;
          if (isTrackMuted) {
            combinedVolume = 0;
          } else {
            const audioFadeIn = clip.effects?.fadeIn ?? 0;
            const audioFadeOut = clip.effects?.fadeOut ?? 0;
            let audioFade = 1;
            if (audioFadeIn > 0 || audioFadeOut > 0) {
              const elapsedTime = currentTimeRef.current - clip.startTime;
              const remainingTime = clipEndTime - currentTimeRef.current;
              if (audioFadeIn > 0 && elapsedTime < audioFadeIn) {
                audioFade = Math.min(audioFade, elapsedTime / audioFadeIn);
              }
              if (audioFadeOut > 0 && remainingTime < audioFadeOut) {
                audioFade = Math.min(audioFade, remainingTime / audioFadeOut);
              }
              audioFade = Math.max(0, Math.min(1, audioFade));
            }
            combinedVolume = Math.max(0, Math.min(1, uiVolume * trackVol * clipVolume * audioFade));
          }

          const effects = hasActiveKeyframes(clip)
            ? getEffectsAtTime(clip, currentTimeRef.current - clip.startTime)
            : { ...DEFAULT_EFFECTS, ...clip.effects };
          audioEngine.updateEffects(VIDEO_AUDIO_ID, effects, combinedVolume);
        }

        // WebGL Canvas レンダリング（HSL色域別調整等）
        if (renderCanvasFrameRef.current) renderCanvasFrameRef.current();
        // スコープ解析用フレームキャプチャ
        if (captureFrameRef.current) captureFrameRef.current();
      } else {
        // --- ギャップ区間 ---
        const newTime = currentTimeRef.current + delta;

        const nextClip = findNextClipAfter(currentTimeRef.current);
        if (!nextClip) {
          setIsPlaying(false);
          useTimelineStore.getState().setIsPlaying(false);
          if (videoRef.current) videoRef.current.pause();
          playbackRafRef.current = null;
          return;
        }

        if (newTime >= nextClip.startTime) {
          currentTimeRef.current = nextClip.startTime;
          useTimelineStore.getState().setCurrentTime(nextClip.startTime);
          updateTimeDisplay(nextClip.startTime);

          const url = useVideoPreviewStore.getState().videoUrls[nextClip.filePath];
          if (url) {
            switchVideo(url, nextClip.sourceStartTime, true);
          }
        } else {
          currentTimeRef.current = newTime;
          useTimelineStore.getState().setCurrentTime(newTime);
          updateTimeDisplay(newTime);
        }
      }

      playbackRafRef.current = window.requestAnimationFrame(tick);
    };

    playbackRafRef.current = window.requestAnimationFrame(tick);
  }, [
    stopPlaybackLoop,
    findClipAtTime,
    findNextClipAfter,
    findTransitionAtTime,
    switchVideo,
    switchTransitionVideo,
    getTransitionStyles,
    updateTimeDisplay,
    setIsPlaying,
    videoRef,
    currentTimeRef,
    transitionVideoRef,
    loadedVideoUrl,
    loadedTransitionVideoUrl,
    isLoadingVideoRef,
    isLoadingTransitionVideoRef,
    isInTransitionRef,
  ]);

  // RAF クリーンアップ
  useEffect(() => {
    return () => {
      stopPlaybackLoop();
    };
  }, [stopPlaybackLoop]);

  // timelineStore の currentTime 変更を監視して表示を更新
  useEffect(() => {
    return useTimelineStore.subscribe((state) => {
      updateTimeDisplay(state.currentTime);
    });
  }, [updateTimeDisplay]);

  return {
    timeDisplayRef,
    seekBarRef,
    formatTime,
    updateTimeDisplay,
    startPlaybackLoop,
    stopPlaybackLoop,
  };
};
