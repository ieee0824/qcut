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
  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    videoUrls,
    setIsPlaying,
    setCurrentTime,
    setDuration,
  } = useVideoPreviewStore();
  
  // タイムラインとの同期
  const timelineStore = useTimelineStore();

  // タイムライン位置に対応するクリップを見つける
  const findClipAtTime = useCallback((time: number) => {
    for (const track of timelineStore.tracks) {
      if (track.type === 'video') {
        for (const clip of track.clips) {
          if (time >= clip.startTime && time < clip.startTime + clip.duration) {
            return clip;
          }
        }
      }
    }
    return null;
  }, [timelineStore.tracks]);
  
  // タイムライン時間から動画ソース時間に変換
  const timelineTimeToSourceTime = useCallback((timelineTime: number) => {
    const clip = findClipAtTime(timelineTime);
    if (!clip) return 0;
    
    const relativeTime = timelineTime - clip.startTime;
    return clip.sourceStartTime + relativeTime;
  }, [findClipAtTime]);
  
  // 動画ソース時間をタイムライン時間に変換
  const sourceTimeToTimelineTime = useCallback((sourceTime: number, clip: any) => {
    if (!clip) return sourceTime;
    const relativeTime = sourceTime - clip.sourceStartTime;
    return clip.startTime + relativeTime;
  }, []);

  // currentTime を ref で追跡（src切り替え時に最新値を使うため）
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // 現在のタイムライン位置に対応するクリップ
  const currentClip = useMemo(() => {
    return findClipAtTime(currentTime);
  }, [currentTime, findClipAtTime]);

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
    timelineStore.setIsPlaying(false);
  }, [setIsPlaying, timelineStore]);

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
      const sourceTime = timelineTimeToSourceTime(currentTime);
      videoRef.current.currentTime = sourceTime;
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying, currentTime, timelineTimeToSourceTime, hasCurrentClip, stopPlayback]);

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
    if (!videoRef.current || isPlaying) return; // 再生中は handleTimeUpdate で処理
    
    const sourceTime = timelineTimeToSourceTime(currentTime);
    if (Math.abs(videoRef.current.currentTime - sourceTime) > 0.1) {
      videoRef.current.currentTime = sourceTime;
    }
  }, [currentTime, isPlaying, timelineTimeToSourceTime]);

  const handleMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    
    const currentClip = findClipAtTime(currentTime);
    if (!currentClip) {
      // クリップがない場合は停止
      setIsPlaying(false);
      timelineStore.setIsPlaying(false);
      videoRef.current.pause();
      return;
    }
    
    const videoSourceTime = videoRef.current.currentTime;
    const timelineTime = sourceTimeToTimelineTime(videoSourceTime, currentClip);
    
    // クリップの終わりを超えた場合
    const clipEndTime = currentClip.startTime + currentClip.duration;
    if (timelineTime >= clipEndTime) {
      // 次のクリップを探す
      const nextClip = findClipAtTime(clipEndTime + 0.01);
      if (nextClip) {
        // 次のクリップの開始位置に移動
        videoRef.current.currentTime = nextClip.sourceStartTime;
        setCurrentTime(nextClip.startTime);
        timelineStore.setCurrentTime(nextClip.startTime);
      } else {
        // 次のクリップがない場合は停止
        setIsPlaying(false);
        timelineStore.setIsPlaying(false);
        videoRef.current.pause();
      }
      return;
    }
    
    // クリップの範囲外の場合（sourceEndTimeを超えた）
    if (videoSourceTime >= currentClip.sourceEndTime) {
      // 次のクリップを探す
      const nextClip = findClipAtTime(clipEndTime + 0.01);
      if (nextClip) {
        videoRef.current.currentTime = nextClip.sourceStartTime;
        setCurrentTime(nextClip.startTime);
        timelineStore.setCurrentTime(nextClip.startTime);
      } else {
        setIsPlaying(false);
        timelineStore.setIsPlaying(false);
        videoRef.current.pause();
      }
      return;
    }
    
    setCurrentTime(timelineTime);
    timelineStore.setCurrentTime(timelineTime);
  }, [currentTime, findClipAtTime, sourceTimeToTimelineTime, setCurrentTime, setIsPlaying, timelineStore]);

  const handleEnded = () => {
    setIsPlaying(false);
    timelineStore.setIsPlaying(false);
  };

  const handlePlayPause = () => {
    // 削除済み部分では再生を開始しない
    if (!isPlaying && !findClipAtTime(currentTime)) {
      return;
    }

    const newPlayingState = !isPlaying;
    setIsPlaying(newPlayingState);
    timelineStore.setIsPlaying(newPlayingState);
  };

  const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const timelineTime = parseFloat(e.target.value);
    const sourceTime = timelineTimeToSourceTime(timelineTime);
    
    setCurrentTime(timelineTime);
    timelineStore.setCurrentTime(timelineTime);
    
    if (videoRef.current) {
      videoRef.current.currentTime = sourceTime;
    }
  }, [timelineTimeToSourceTime, setCurrentTime, timelineStore]);

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

        <span style={{ fontSize: '12px', color: '#666', minWidth: '100px' }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* シークバー */}
      {Object.keys(videoUrls).length > 0 && (
        <input
          type="range"
          min="0"
          max={Number.isFinite(duration) ? duration : 0}
          value={currentTime}
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
