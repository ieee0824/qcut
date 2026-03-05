import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVideoPreviewStore } from '../../store/videoPreviewStore';
import { useTimelineStore } from '../../store/timelineStore';

interface VideoPreviewProps {
  width?: string;
  height?: string;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  width = '100%',
  height = '400px',
}) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const preloadVideoRef = useRef<HTMLVideoElement>(null);
  const preloadedUrlRef = useRef<string>('');
  const loadedVideoUrl = useRef<string | null>(null);
  const currentTimeRef = useRef(0);
  const playbackRafRef = useRef<number | null>(null);
  const lastTimestampRef = useRef(0);
  const timeDisplayRef = useRef<globalThis.HTMLSpanElement>(null);
  const seekBarRef = useRef<HTMLInputElement>(null);
  // 動画ファイル切替中フラグ（load〜loadedmetadata 間）
  const isLoadingVideoRef = useRef(false);

  const {
    isPlaying,
    duration,
    volume,
    videoUrls,
    setIsPlaying,
    setCurrentTime: setVideoPreviewCurrentTime,
    setDuration,
  } = useVideoPreviewStore();

  // timelineStore はセレクタで必要なものだけ subscribe
  const tracks = useTimelineStore((s) => s.tracks);

  // タイムライン位置に対応するクリップを見つける
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

  // 指定時刻以降で最も近いクリップを見つける（ギャップを飛ばす）
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

  // タイムライン時間から動画ソース時間に変換
  const timelineTimeToSourceTime = useCallback((timelineTime: number) => {
    const clip = findClipAtTime(timelineTime);
    if (!clip) return 0;

    const relativeTime = timelineTime - clip.startTime;
    return clip.sourceStartTime + relativeTime;
  }, [findClipAtTime]);

  // 時間表示のフォーマット
  const formatTime = useCallback((seconds: number): string => {
    if (!Number.isFinite(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, []);

  // 時間表示とシークバーを DOM 直接更新
  const updateTimeDisplay = useCallback((time: number) => {
    currentTimeRef.current = time;
    if (timeDisplayRef.current) {
      const dur = useVideoPreviewStore.getState().duration;
      timeDisplayRef.current.textContent = `${formatTime(time)} / ${formatTime(dur)}`;
    }
    if (seekBarRef.current) {
      seekBarRef.current.value = String(time);
    }
  }, [formatTime]);

  // 動画ファイルを切り替えてシーク・再生する
  const switchVideo = useCallback((url: string, sourceTime: number, autoPlay: boolean) => {
    if (!videoRef.current) return;
    if (url === loadedVideoUrl.current) {
      // 同じファイル → シークのみ
      videoRef.current.currentTime = sourceTime;
      if (autoPlay && videoRef.current.paused) {
        videoRef.current.play();
      }
      return;
    }
    // 別ファイル → src 切替
    isLoadingVideoRef.current = true;
    loadedVideoUrl.current = url;
    videoRef.current.src = url;
    videoRef.current.load();
    videoRef.current.addEventListener(
      'loadedmetadata',
      () => {
        isLoadingVideoRef.current = false;
        if (!videoRef.current) return;
        videoRef.current.currentTime = sourceTime;
        setDuration(videoRef.current.duration);
        if (autoPlay) {
          videoRef.current.play();
        }
      },
      { once: true },
    );
  }, [setDuration]);

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

      if (clip) {
        // --- クリップ区間 ---
        const url = useVideoPreviewStore.getState().videoUrls[clip.filePath];

        if (isLoadingVideoRef.current) {
          // 動画ロード中: delta で時間を進める（映像はまだ出ないがタイムラインは進む）
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
        // シーク完了前はdeltaで仮進行
        if (videoSourceTime < clip.sourceStartTime - 0.15) {
          const newTime = currentTimeRef.current + delta;
          useTimelineStore.getState().setCurrentTime(newTime);
          updateTimeDisplay(newTime);
          playbackRafRef.current = window.requestAnimationFrame(tick);
          return;
        }

        const relativeTime = videoSourceTime - clip.sourceStartTime;
        const timelineTime = clip.startTime + relativeTime;
        const clipEndTime = clip.startTime + clip.duration;

        if (timelineTime >= clipEndTime || videoSourceTime >= clip.sourceEndTime) {
          // クリップ終端 → 次のクリップまたはギャップへ
          currentTimeRef.current = clipEndTime;
          useTimelineStore.getState().setCurrentTime(clipEndTime);
          updateTimeDisplay(clipEndTime);

          // 隣接クリップを探す
          const adjacentClip = findClipAtTime(clipEndTime + 0.01);
          if (adjacentClip) {
            const isContinuous = adjacentClip.filePath === clip.filePath
              && Math.abs(adjacentClip.sourceStartTime - clip.sourceEndTime) < 0.05;
            if (!isContinuous) {
              const adjUrl = useVideoPreviewStore.getState().videoUrls[adjacentClip.filePath];
              if (adjUrl) {
                switchVideo(adjUrl, adjacentClip.sourceStartTime, true);
              }
            }
            // continuous の場合は動画はそのまま再生し続ける
          } else {
            // ギャップに入る → 動画を一時停止（次のtickでギャップ処理）
            videoRef.current.pause();
          }
        } else {
          // 通常再生: タイムラインを更新
          currentTimeRef.current = timelineTime;
          useTimelineStore.getState().setCurrentTime(timelineTime);
          updateTimeDisplay(timelineTime);
        }
      } else {
        // --- ギャップ区間 ---
        // delta で時間を進める（黒画面）
        const newTime = currentTimeRef.current + delta;

        // 次のクリップを探す
        const nextClip = findNextClipAfter(currentTimeRef.current);
        if (!nextClip) {
          // タイムライン終端 → 再生停止
          setIsPlaying(false);
          useTimelineStore.getState().setIsPlaying(false);
          if (videoRef.current) videoRef.current.pause();
          playbackRafRef.current = null;
          return;
        }

        if (newTime >= nextClip.startTime) {
          // ギャップ終了 → 次のクリップへ
          currentTimeRef.current = nextClip.startTime;
          useTimelineStore.getState().setCurrentTime(nextClip.startTime);
          updateTimeDisplay(nextClip.startTime);

          const url = useVideoPreviewStore.getState().videoUrls[nextClip.filePath];
          if (url) {
            switchVideo(url, nextClip.sourceStartTime, true);
          }
        } else {
          // ギャップ内を進行中
          currentTimeRef.current = newTime;
          useTimelineStore.getState().setCurrentTime(newTime);
          updateTimeDisplay(newTime);
        }
      }

      playbackRafRef.current = window.requestAnimationFrame(tick);
    };

    playbackRafRef.current = window.requestAnimationFrame(tick);
  }, [stopPlaybackLoop, findClipAtTime, findNextClipAfter, switchVideo, updateTimeDisplay, setIsPlaying]);

  // RAF クリーンアップ
  useEffect(() => {
    return () => {
      stopPlaybackLoop();
    };
  }, [stopPlaybackLoop]);

  // timelineStore の currentTime 変更を監視して表示を更新（シーク等の外部変更に対応）
  useEffect(() => {
    return useTimelineStore.subscribe((state) => {
      updateTimeDisplay(state.currentTime);
    });
  }, [updateTimeDisplay]);

  // duration 変更時に表示を更新
  useEffect(() => {
    updateTimeDisplay(currentTimeRef.current);
  }, [duration, updateTimeDisplay]);

  // 現在のタイムライン位置に対応するクリップ
  // クリップが変わったときだけ再レンダー（毎フレームではなく）
  const [currentClipId, setCurrentClipId] = useState<string | null>(null);

  // tracks 変更時とcurrentTime変更時にクリップを再評価
  useEffect(() => {
    const clip = findClipAtTime(currentTimeRef.current);
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

  // 現在のクリップの動画URL（filePath → objectURL マップから取得）
  const currentVideoUrl = useMemo(() => {
    if (!currentClip) return null;
    return videoUrls[currentClip.filePath] ?? null;
  }, [currentClip, videoUrls]);

  // 現在のタイムライン位置に対応するクリップが存在するかチェック
  const hasCurrentClip = useMemo(() => {
    return currentClip !== null && currentVideoUrl !== null;
  }, [currentClip, currentVideoUrl]);

  // エフェクトから CSS filter 文字列を生成
  const cssFilter = useMemo(() => {
    if (!currentClip?.effects) return 'none';
    const e = currentClip.effects;
    return `brightness(${e.brightness}) contrast(${e.contrast}) saturate(${e.saturation})`;
  }, [currentClip?.effects]);

  // トランスフォームから CSS transform 文字列を生成
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

  // 次のクリップの動画を事前にプリロード（クリップ切り替わり時のもたつき軽減）
  useEffect(() => {
    if (!currentClip) return;
    const clipEnd = currentClip.startTime + currentClip.duration;
    const nextClip = findNextClipAfter(clipEnd);
    if (!nextClip || nextClip.filePath === currentClip.filePath) return;

    const nextUrl = videoUrls[nextClip.filePath];
    if (!nextUrl || nextUrl === preloadedUrlRef.current) return;

    preloadedUrlRef.current = nextUrl;
    if (preloadVideoRef.current) {
      preloadVideoRef.current.src = nextUrl;
      preloadVideoRef.current.load();
    }
  }, [currentClip, findNextClipAfter, videoUrls]);

  // 動画ファイルが切り替わったとき src を更新してシーク（停止中のみ）
  useEffect(() => {
    if (!videoRef.current) return;
    // 再生中は playback loop が switchVideo で処理する
    if (useVideoPreviewStore.getState().isPlaying) return;
    if (currentVideoUrl === loadedVideoUrl.current) return;

    loadedVideoUrl.current = currentVideoUrl;
    if (!currentVideoUrl) return;

    const targetSourceTime = timelineTimeToSourceTime(currentTimeRef.current);
    const video = videoRef.current;
    video.src = currentVideoUrl;
    video.load();

    video.addEventListener(
      'loadedmetadata',
      () => {
        if (!videoRef.current) return;
        videoRef.current.currentTime = targetSourceTime;
        setDuration(videoRef.current.duration);
      },
      { once: true },
    );
  }, [currentVideoUrl, timelineTimeToSourceTime, setDuration]);

  // 再生/停止の同期
  useEffect(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      startPlaybackLoop();
    } else {
      stopPlaybackLoop();
      videoRef.current.pause();
      // 停止時にストアを同期
      setVideoPreviewCurrentTime(currentTimeRef.current);
    }
  }, [isPlaying, startPlaybackLoop, stopPlaybackLoop, setVideoPreviewCurrentTime]);

  // 音量の同期
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume / 100;
    }
  }, [volume]);

  // タイムライン位置が外部から変更されたとき（シーク）に動画ソース位置も更新
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

  const handleMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handlePlayPause = () => {
    // 再生開始時: クリップもギャップ先のクリップもなければ開始しない
    if (!isPlaying && !findClipAtTime(currentTimeRef.current) && !findNextClipAfter(currentTimeRef.current)) {
      return;
    }

    const newPlayingState = !isPlaying;
    setIsPlaying(newPlayingState);
    useTimelineStore.getState().setIsPlaying(newPlayingState);
  };

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const timelineTime = parseFloat(e.target.value);
    const sourceTime = timelineTimeToSourceTime(timelineTime);

    setVideoPreviewCurrentTime(timelineTime);
    useTimelineStore.getState().setCurrentTime(timelineTime);
    updateTimeDisplay(timelineTime);

    if (videoRef.current) {
      videoRef.current.currentTime = sourceTime;
    }
  }, [timelineTimeToSourceTime, setVideoPreviewCurrentTime, updateTimeDisplay]);

  return (
    <div
      style={{
        width,
        height,
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '12px',
        backgroundColor: '#1a1a1a',
      }}
    >
      {/* ビデオプレイヤー（常にDOMに存在させ、ギャップ中に消えないようにする） */}
      <div style={{ position: 'relative', width: '100%', flex: 1, minHeight: 0, overflow: 'hidden' }}>
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
