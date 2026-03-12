import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { useVideoPreviewStore } from '../../store/videoPreviewStore';
import type { Clip as ClipType } from '../../store/timelineStore';

interface UseVideoSwitchingParams {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  currentTimeRef: React.MutableRefObject<number>;
  currentClip: ClipType | null;
  currentVideoUrl: string | null;
  findNextClipAfter: (time: number) => ClipType | null;
  timelineTimeToSourceTime: (time: number) => number;
  videoUrls: Record<string, string>;
  isHlsModeRef: React.MutableRefObject<boolean>;
}

interface UseVideoSwitchingReturn {
  preloadVideoRef: React.RefObject<HTMLVideoElement | null>;
  loadedVideoUrl: React.MutableRefObject<string | null>;
  isLoadingVideoRef: React.MutableRefObject<boolean>;
  switchVideo: (url: string, sourceTime: number, autoPlay: boolean) => void;
}

export const useVideoSwitching = ({
  videoRef,
  currentTimeRef,
  currentClip,
  currentVideoUrl,
  findNextClipAfter,
  timelineTimeToSourceTime,
  videoUrls,
  isHlsModeRef,
}: UseVideoSwitchingParams): UseVideoSwitchingReturn => {
  const preloadVideoRef = useRef<HTMLVideoElement>(null);
  const preloadedUrlRef = useRef<string>('');
  const loadedVideoUrl = useRef<string | null>(null);
  const isLoadingVideoRef = useRef(false);

  const { setDuration } = useVideoPreviewStore();

  const switchVideo = useCallback(
    (url: string, sourceTime: number, autoPlay: boolean) => {
      if (!videoRef.current) return;
      if (url === loadedVideoUrl.current) {
        videoRef.current.currentTime = sourceTime;
        if (autoPlay && videoRef.current.paused) {
          videoRef.current.play();
        }
        return;
      }
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
    },
    [videoRef, setDuration],
  );

  // 次のクリップの動画を事前にプリロード
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

  // 動画ファイルが切り替わったとき src を更新してシーク（停止中かつ非 HLS モードのみ）
  useEffect(() => {
    if (!videoRef.current) return;
    if (useVideoPreviewStore.getState().isPlaying) return;
    if (isHlsModeRef.current) return;
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
  }, [videoRef, currentTimeRef, currentVideoUrl, timelineTimeToSourceTime, setDuration, isHlsModeRef]);

  return {
    preloadVideoRef,
    loadedVideoUrl,
    isLoadingVideoRef,
    switchVideo,
  };
};
