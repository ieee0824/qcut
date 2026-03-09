import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVideoPreviewStore } from '../../store/videoPreviewStore';
import { useTimelineStore, DEFAULT_EFFECTS } from '../../store/timelineStore';
import { useTextOverlays } from './useTextOverlays';
import { useTransitionEffect } from './useTransitionEffect';
import { useVideoSwitching } from './useVideoSwitching';
import { usePlaybackLoop } from './usePlaybackLoop';
import { useAudioTrackPlayback } from './useAudioTrackPlayback';
import { audioEngine } from '../../audio/AudioEngine';

const VIDEO_AUDIO_ID = '__video_main__';

interface VideoPreviewProps {
  width?: string;
  height?: string;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  width = '100%',
  height = '100%',
}) => {
  const { t } = useTranslation();

  const {
    isPlaying,
    duration,
    volume,
    videoUrls,
    setIsPlaying,
    setCurrentTime: setVideoPreviewCurrentTime,
    setDuration,
    setPreviewContainerHeight,
  } = useVideoPreviewStore();

  const tracks = useTimelineStore((s) => s.tracks);

  // プレビューコンテナの高さを監視
  const previewContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setPreviewContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [setPreviewContainerHeight]);

  // 共有 ref（複数フックで使用するため親で作成）
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentTimeRef = useRef(0);

  // --- クリップ検索（複数フックの共通依存） ---
  const findClipAtTime = useCallback((time: number) => {
    const currentTracks = useTimelineStore.getState().tracks;
    for (const track of currentTracks) {
      if (track.type === 'video') {
        for (const clip of track.clips) {
          if (time >= clip.startTime && time < clip.startTime + clip.duration) {
            return clip;
          }
        }
      }
    }
    return null;
  }, []);

  const findNextClipAfter = useCallback((time: number) => {
    const currentTracks = useTimelineStore.getState().tracks;
    let best: ReturnType<typeof findClipAtTime> = null;
    for (const track of currentTracks) {
      if (track.type === 'video') {
        for (const clip of track.clips) {
          if (clip.startTime >= time) {
            if (!best || clip.startTime < best.startTime) {
              best = clip;
            }
          }
        }
      }
    }
    return best;
  }, []);

  const timelineTimeToSourceTime = useCallback(
    (timelineTime: number) => {
      const clip = findClipAtTime(timelineTime);
      if (!clip) return 0;
      const relativeTime = timelineTime - clip.startTime;
      return clip.sourceStartTime + relativeTime;
    },
    [findClipAtTime],
  );

  // --- 現在のクリップ追跡 ---
  const [currentClipId, setCurrentClipId] = useState<string | null>(null);

  useEffect(() => {
    const clip = findClipAtTime(useTimelineStore.getState().currentTime);
    setCurrentClipId(clip?.id ?? null);

    return useTimelineStore.subscribe((state) => {
      const newClip = findClipAtTime(state.currentTime);
      setCurrentClipId((prev) => {
        const newId = newClip?.id ?? null;
        return prev === newId ? prev : newId;
      });
    });
  }, [tracks, findClipAtTime]);

  const currentClip = useMemo(() => {
    if (!currentClipId) return null;
    for (const track of tracks) {
      for (const clip of track.clips) {
        if (clip.id === currentClipId) return clip;
      }
    }
    return null;
  }, [currentClipId, tracks]);

  const currentVideoUrl = useMemo(() => {
    if (!currentClip) return null;
    return videoUrls[currentClip.filePath] ?? null;
  }, [currentClip, videoUrls]);

  const hasCurrentClip = currentClip !== null && currentVideoUrl !== null;

  // --- カスタムフック ---
  useAudioTrackPlayback();

  // video 要素の AudioEngine 接続をクリーンアップ
  useEffect(() => {
    return () => {
      audioEngine.disconnect(VIDEO_AUDIO_ID);
    };
  }, []);

  const { textOverlays, textCurrentTime, calcTextOpacity, calcTextTranslateY } = useTextOverlays();

  const {
    transitionVideoRef,
    loadedTransitionVideoUrl,
    isLoadingTransitionVideoRef,
    isInTransitionRef,
    findTransitionAtTime,
    getTransitionStyles,
    switchTransitionVideo,
  } = useTransitionEffect({ findClipAtTime });

  const { preloadVideoRef, loadedVideoUrl, isLoadingVideoRef, switchVideo } = useVideoSwitching({
    videoRef,
    currentTimeRef,
    currentClip,
    currentVideoUrl,
    findNextClipAfter,
    timelineTimeToSourceTime,
    videoUrls,
  });

  const { timeDisplayRef, seekBarRef, formatTime, updateTimeDisplay, startPlaybackLoop, stopPlaybackLoop } =
    usePlaybackLoop({
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
    });

  // --- エフェクト CSS ---
  const cssFilter = useMemo(() => {
    if (!currentClip?.effects) return 'none';
    const e = currentClip.effects;
    let filter = `brightness(${e.brightness}) contrast(${e.contrast}) saturate(${e.saturation})`;

    const hue = e.hue ?? 0;
    if (hue !== 0) {
      filter += ` hue-rotate(${hue}deg)`;
    }

    const temp = e.colorTemperature ?? 0;
    if (temp > 0.01) {
      const sepiaAmount = temp * 0.3;
      const hueShift = temp * -10;
      filter += ` sepia(${sepiaAmount}) hue-rotate(${hueShift}deg)`;
    } else if (temp < -0.01) {
      const hueShift = temp * 30;
      const satBoost = 1 + Math.abs(temp) * 0.2;
      filter += ` hue-rotate(${hueShift}deg) saturate(${satBoost})`;
    }

    return filter;
  }, [currentClip?.effects]);

  const cssTransform = useMemo(() => {
    if (!currentClip?.effects) return 'none';
    const e = currentClip.effects;
    const r = e.rotation ?? 0;
    const sx = e.scaleX ?? 1;
    const sy = e.scaleY ?? 1;
    const px = e.positionX ?? 0;
    const py = e.positionY ?? 0;
    if (r === 0 && sx === 1 && sy === 1 && px === 0 && py === 0) return 'none';
    return `translate(${px}px, ${py}px) rotate(${r}deg) scaleX(${sx}) scaleY(${sy})`;
  }, [currentClip?.effects]);

  // --- duration 変更時に表示を更新 ---
  useEffect(() => {
    updateTimeDisplay(currentTimeRef.current);
  }, [duration, updateTimeDisplay, currentTimeRef]);

  // --- 再生/停止の同期 ---
  useEffect(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      startPlaybackLoop();
    } else {
      stopPlaybackLoop();
      videoRef.current.pause();
      if (transitionVideoRef.current) {
        transitionVideoRef.current.pause();
        transitionVideoRef.current.style.visibility = 'hidden';
      }
      if (isInTransitionRef.current) {
        isInTransitionRef.current = false;
        videoRef.current.style.opacity = '1';
        videoRef.current.style.clipPath = '';
      }
      setVideoPreviewCurrentTime(currentTimeRef.current);
    }
  }, [isPlaying, startPlaybackLoop, stopPlaybackLoop, setVideoPreviewCurrentTime, transitionVideoRef, isInTransitionRef, currentTimeRef]);

  // --- 音量の同期（Web Audio API 経由） ---
  useEffect(() => {
    if (videoRef.current) {
      if (!audioEngine.hasGraph(VIDEO_AUDIO_ID)) {
        audioEngine.connect(VIDEO_AUDIO_ID, videoRef.current);
      }
      const clip = findClipAtTime(currentTimeRef.current);
      const clipVolume = clip?.effects?.volume ?? 1.0;
      const allTracks = useTimelineStore.getState().tracks;
      const videoTrack = clip ? allTracks.find(t => t.type === 'video' && t.clips.some(c => c.id === clip.id)) : undefined;
      const hasSolo = allTracks.some(t => t.solo);
      const isTrackMuted = videoTrack ? (videoTrack.mute || (hasSolo && !videoTrack.solo)) : false;
      const trackVol = videoTrack?.volume ?? 1.0;
      const combinedVolume = isTrackMuted ? 0 : Math.max(0, Math.min(1, (volume / 100) * trackVol * clipVolume));
      const effects = { ...DEFAULT_EFFECTS, ...clip?.effects };
      audioEngine.updateEffects(VIDEO_AUDIO_ID, effects, combinedVolume);
    }
  }, [volume, findClipAtTime, currentTimeRef]);

  // --- タイムライン位置が外部から変更されたとき（シーク）に動画ソース位置も更新 ---
  useEffect(() => {
    if (!videoRef.current || isPlaying) return;

    return useTimelineStore.subscribe((state) => {
      if (!videoRef.current || useVideoPreviewStore.getState().isPlaying) return;
      const sourceTime = timelineTimeToSourceTime(state.currentTime);
      if (Math.abs(videoRef.current.currentTime - sourceTime) > 0.1) {
        videoRef.current.currentTime = sourceTime;
      }
    });
  }, [isPlaying, timelineTimeToSourceTime]);

  // --- イベントハンドラ ---
  const handleMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handlePlayPause = () => {
    if (!isPlaying && !findClipAtTime(currentTimeRef.current) && !findNextClipAfter(currentTimeRef.current)) {
      return;
    }
    const newPlayingState = !isPlaying;
    setIsPlaying(newPlayingState);
    useTimelineStore.getState().setIsPlaying(newPlayingState);
  };

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const timelineTime = parseFloat(e.target.value);
      const sourceTime = timelineTimeToSourceTime(timelineTime);

      setVideoPreviewCurrentTime(timelineTime);
      useTimelineStore.getState().setCurrentTime(timelineTime);
      updateTimeDisplay(timelineTime);

      if (videoRef.current) {
        videoRef.current.currentTime = sourceTime;
      }
    },
    [timelineTimeToSourceTime, setVideoPreviewCurrentTime, updateTimeDisplay],
  );

  // --- レンダリング ---
  return (
    <div
      style={{
        width,
        height,
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '8px',
        backgroundColor: '#1a1a1a',
      }}
    >
      {/* ビデオプレイヤー */}
      <div ref={previewContainerRef} style={{ position: 'relative', width: '100%', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <video
          ref={videoRef}
          onLoadedMetadata={handleMetadata}
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#000',
            borderRadius: '4px',
            visibility: hasCurrentClip ? 'visible' : 'hidden',
            filter: cssFilter,
            transform: cssTransform,
            transformOrigin: 'center center',
          }}
        />
        {/* トランジション用ビデオ（incoming clip） */}
        <video
          ref={transitionVideoRef}
          muted
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'transparent',
            borderRadius: '4px',
            visibility: 'hidden',
            objectFit: 'contain',
          }}
        />
        {!hasCurrentClip && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: '#000',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '14px',
            }}
          >
            {!Object.keys(videoUrls).length && t('fileOperations.noFile')}
          </div>
        )}
        {/* テキストオーバーレイ */}
        {textOverlays.map((clip) => {
          const tp = clip.textProperties!;
          const elapsed = textCurrentTime - clip.startTime;
          const opacity = calcTextOpacity(tp, elapsed, clip.duration);
          const translateY = calcTextTranslateY(tp, elapsed, clip.duration);
          return (
            <div
              key={clip.id}
              style={{
                position: 'absolute',
                left: `${tp.positionX}%`,
                top: `${tp.positionY}%`,
                transform: `translate(-50%, -50%) translateY(${translateY}px)`,
                fontSize: `${tp.fontSize}px`,
                fontFamily: tp.fontFamily,
                fontWeight: tp.bold ? 'bold' : 'normal',
                fontStyle: tp.italic ? 'italic' : 'normal',
                textAlign: tp.textAlign,
                color: tp.fontColor,
                opacity,
                backgroundColor: tp.backgroundColor === 'transparent' ? undefined : tp.backgroundColor,
                padding: tp.backgroundColor !== 'transparent' ? '4px 8px' : undefined,
                borderRadius: tp.backgroundColor !== 'transparent' ? '4px' : undefined,
                textShadow: '1px 1px 3px rgba(0,0,0,0.8), -1px -1px 3px rgba(0,0,0,0.8)',
                whiteSpace: 'pre-wrap',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            >
              {tp.text}
            </div>
          );
        })}
      </div>

      {/* プリロード用（非表示） */}
      <video ref={preloadVideoRef} preload="auto" muted style={{ display: 'none' }} />

      {/* コントロール */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        <button
          onClick={handlePlayPause}
          disabled={Object.keys(videoUrls).length === 0}
          style={{
            padding: '6px 12px',
            fontSize: '14px',
            cursor: Object.keys(videoUrls).length > 0 ? 'pointer' : 'not-allowed',
            backgroundColor: Object.keys(videoUrls).length > 0 ? '#007bff' : '#ccc',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          {isPlaying ? '⏸️ 停止' : '▶️ 再生'}
        </button>

        <span ref={timeDisplayRef} style={{ fontSize: '12px', color: '#666', minWidth: '100px' }}>
          {formatTime(0)} / {formatTime(duration)}
        </span>
      </div>

      {/* シークバー */}
      {Object.keys(videoUrls).length > 0 && (
        <input
          ref={seekBarRef}
          type="range"
          min="0"
          max={Number.isFinite(duration) ? duration : 0}
          defaultValue={0}
          onChange={handleSeek}
          style={{
            width: '100%',
            cursor: 'pointer',
          }}
        />
      )}
    </div>
  );
};
