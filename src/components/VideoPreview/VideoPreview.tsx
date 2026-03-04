import React, { useRef, useEffect, useCallback, useMemo } from 'react';
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
  const loadedVideoUrl = useRef<string | null>(null);
  const currentTimeRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const timeDisplayRef = useRef<globalThis.HTMLSpanElement>(null);
  const seekBarRef = useRef<HTMLInputElement>(null);

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

  // 指定クリップの直後のクリップを見つける
  const findNextClip = useCallback((clipEndTime: number) => {
    const currentTracks = useTimelineStore.getState().tracks;
    for (const track of currentTracks) {
      if (track.type === 'video') {
        for (const clip of track.clips) {
          if (clip.startTime >= clipEndTime && clip.startTime < clipEndTime + 0.05) {
            return clip;
          }
        }
      }
    }
    return null;
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

  // RAF クリーンアップ
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

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
  // tracks の変更時にも再計算する（ファイル読み込み時にクリップが追加されるため）
  const currentClip = useMemo(() => {
    const time = currentTimeRef.current;
    for (const track of tracks) {
      if (track.type === 'video') {
        for (const clip of track.clips) {
          if (time >= clip.startTime && time < clip.startTime + clip.duration) {
            return clip;
          }
        }
      }
    }
    return null;
  }, [tracks]);

  // 現在のクリップの動画URL（filePath → objectURL マップから取得）
  const currentVideoUrl = useMemo(() => {
    if (!currentClip) return null;
    return videoUrls[currentClip.filePath] ?? null;
  }, [currentClip, videoUrls]);

  // 現在のタイムライン位置に対応するクリップが存在するかチェック
  const hasCurrentClip = useMemo(() => {
    return currentClip !== null && currentVideoUrl !== null;
  }, [currentClip, currentVideoUrl]);

  // 動画ファイルが切り替わったとき src を更新してシーク
  useEffect(() => {
    if (!videoRef.current) return;
    if (currentVideoUrl === loadedVideoUrl.current) return;

    loadedVideoUrl.current = currentVideoUrl;
    if (!currentVideoUrl) return;

    const targetSourceTime = timelineTimeToSourceTime(currentTimeRef.current);
    videoRef.current.src = currentVideoUrl;
    videoRef.current.load();

    videoRef.current.addEventListener(
      'loadedmetadata',
      () => {
        if (videoRef.current) {
          videoRef.current.currentTime = targetSourceTime;
          setDuration(videoRef.current.duration);
        }
      },
      { once: true },
    );
  }, [currentVideoUrl, timelineTimeToSourceTime, setDuration]);

  // 再生を停止する関数
  const stopPlayback = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setIsPlaying(false);
    useTimelineStore.getState().setIsPlaying(false);
  }, [setIsPlaying]);

  // 再生/停止の同期
  useEffect(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      // 削除済み部分では再生を開始しない
      if (!hasCurrentClip) {
        stopPlayback();
        return;
      }

      // 再生開始時にタイムライン位置に対応する動画ソース位置に移動
      const sourceTime = timelineTimeToSourceTime(currentTimeRef.current);
      videoRef.current.currentTime = sourceTime;
      videoRef.current.play();
    } else {
      videoRef.current.pause();
      // 停止時にストアを同期
      const time = currentTimeRef.current;
      setVideoPreviewCurrentTime(time);
    }
  }, [isPlaying, hasCurrentClip, stopPlayback, timelineTimeToSourceTime, setVideoPreviewCurrentTime]);

  // 再生中に削除済み部分に移動したら停止
  useEffect(() => {
    if (isPlaying && !hasCurrentClip) {
      stopPlayback();
    }
  }, [hasCurrentClip, isPlaying, stopPlayback]);

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

  const handleTimeUpdate = useCallback(() => {
    if (rafIdRef.current !== null) return; // 既にRAFがスケジュール済み

    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = null;
      if (!videoRef.current) return;

      const videoSourceTime = videoRef.current.currentTime;
      const clip = findClipAtTime(currentTimeRef.current);

      if (!clip) {
        setIsPlaying(false);
        useTimelineStore.getState().setIsPlaying(false);
        videoRef.current.pause();
        return;
      }

      // ソース時間からタイムライン時間を算出
      const relativeTime = videoSourceTime - clip.sourceStartTime;
      const timelineTime = clip.startTime + relativeTime;
      const clipEndTime = clip.startTime + clip.duration;

      // クリップの終端を超えた、またはソース終端を超えた場合
      if (timelineTime >= clipEndTime || videoSourceTime >= clip.sourceEndTime) {
        const nextClip = findNextClip(clipEndTime);
        if (nextClip) {
          videoRef.current.currentTime = nextClip.sourceStartTime;
          useTimelineStore.getState().setCurrentTime(nextClip.startTime);
          updateTimeDisplay(nextClip.startTime);
        } else {
          setIsPlaying(false);
          useTimelineStore.getState().setIsPlaying(false);
          videoRef.current.pause();
        }
        return;
      }

      // timelineStore のみ更新（Playhead, Timecode が subscribe で反映）
      // videoPreviewStore は再生停止時にまとめて同期
      useTimelineStore.getState().setCurrentTime(timelineTime);
      updateTimeDisplay(timelineTime);
    });
  }, [findClipAtTime, findNextClip, setIsPlaying, updateTimeDisplay]);

  const handleEnded = () => {
    setIsPlaying(false);
    useTimelineStore.getState().setIsPlaying(false);
  };

  const handlePlayPause = () => {
    // 削除済み部分では再生を開始しない
    if (!isPlaying && !findClipAtTime(currentTimeRef.current)) {
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
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '12px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        backgroundColor: '#f9f9f9',
      }}
    >
      {/* ビデオプレイヤー */}
      {currentVideoUrl ? (
        <video
          ref={videoRef}
          onLoadedMetadata={handleMetadata}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          style={{
            width: '100%',
            height: '300px',
            backgroundColor: '#000',
            borderRadius: '4px',
            visibility: hasCurrentClip ? 'visible' : 'hidden',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '300px',
            backgroundColor: '#000',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '14px',
          }}
        >
          {t('fileOperations.noFile')}
        </div>
      )}

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
