import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
}

interface UseVideoSwitchingReturn {
  preloadVideoRef: React.RefObject<HTMLVideoElement | null>;
  activeVideoRef: React.MutableRefObject<HTMLVideoElement | null>;
  activeVideoSlot: 'primary' | 'preload';
  loadedVideoUrl: React.MutableRefObject<string | null>;
  isLoadingVideoRef: React.MutableRefObject<boolean>;
  switchVideo: (url: string, sourceTime: number, autoPlay: boolean) => void;
}

export function waitForFirstRenderableFrame(
  video: HTMLVideoElement,
  onReady: () => void,
): () => void {
  let finished = false;
  let frameCallbackId: number | null = null;
  let rafId: number | null = null;

  const cleanup = () => {
    video.removeEventListener('playing', handlePlaying);
    video.removeEventListener('loadeddata', handleLoadedData);
    if (frameCallbackId !== null && typeof video.cancelVideoFrameCallback === 'function') {
      video.cancelVideoFrameCallback(frameCallbackId);
      frameCallbackId = null;
    }
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    cleanup();
    onReady();
  };

  const scheduleFrameWait = () => {
    if (frameCallbackId !== null || rafId !== null) {
      return;
    }
    if (typeof video.requestVideoFrameCallback === 'function') {
      frameCallbackId = video.requestVideoFrameCallback(() => finish());
      return;
    }
    rafId = window.requestAnimationFrame(() => finish());
  };

  function handlePlaying() {
    scheduleFrameWait();
  }

  function handleLoadedData() {
    if (!video.paused && video.readyState >= 2) {
      scheduleFrameWait();
    }
  }

  video.addEventListener('playing', handlePlaying);
  video.addEventListener('loadeddata', handleLoadedData);

  if (!video.paused && video.readyState >= 2) {
    scheduleFrameWait();
  }

  return cleanup;
}

export const useVideoSwitching = ({
  videoRef,
  currentTimeRef,
  currentClip,
  currentVideoUrl,
  findNextClipAfter,
  timelineTimeToSourceTime,
  videoUrls,
}: UseVideoSwitchingParams): UseVideoSwitchingReturn => {
  const preloadVideoRef = useRef<HTMLVideoElement>(null);
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);
  const [activeVideoSlot, setActiveVideoSlot] = useState<'primary' | 'preload'>('primary');
  const preloadedUrlRef = useRef<string>('');
  const loadedVideoUrl = useRef<string | null>(null);
  const isLoadingVideoRef = useRef(false);
  const preloadReadyRef = useRef(false);

  const { setDuration, setPrerenderedFrame, clearPrerenderedFrame } = useVideoPreviewStore();

  useEffect(() => {
    if (videoRef.current && !activeVideoRef.current) {
      activeVideoRef.current = videoRef.current;
      setActiveVideoSlot('primary');
    }
  }, [videoRef]);

  const switchVideo = useCallback(
    (url: string, sourceTime: number, autoPlay: boolean) => {
      const active = activeVideoRef.current ?? videoRef.current;
      if (!active) return;

      if (url === loadedVideoUrl.current) {
        active.currentTime = sourceTime;
        if (autoPlay && active.paused) {
          active.play();
        }
        return;
      }

      const inactive = active === videoRef.current ? preloadVideoRef.current : videoRef.current;
      const canSwap = inactive && url === preloadedUrlRef.current && preloadReadyRef.current;

      if (inactive && canSwap) {
        const oldActive = active;
        loadedVideoUrl.current = url;
        activeVideoRef.current = inactive;
        setActiveVideoSlot(inactive === videoRef.current ? 'primary' : 'preload');
        inactive.currentTime = sourceTime;
        setDuration(inactive.duration || oldActive.duration || 0);

        if (autoPlay) {
          const cleanupFrameWait = waitForFirstRenderableFrame(inactive, () => {
            oldActive.pause();
          });
          void inactive.play();
          inactive.addEventListener('emptied', cleanupFrameWait, { once: true });
        } else {
          oldActive.pause();
        }

        preloadReadyRef.current = false;
        preloadedUrlRef.current = '';
        isLoadingVideoRef.current = false;
        return;
      }

      const loadTarget = inactive ?? active;
      const oldActive = active;

      isLoadingVideoRef.current = true;
      loadedVideoUrl.current = url;
      loadTarget.src = url;
      loadTarget.load();
      loadTarget.addEventListener(
        'loadedmetadata',
        () => {
          loadTarget.currentTime = sourceTime;
          setDuration(loadTarget.duration);
          if (autoPlay) {
            const cleanupFrameWait = waitForFirstRenderableFrame(loadTarget, () => {
              activeVideoRef.current = loadTarget;
              setActiveVideoSlot(loadTarget === videoRef.current ? 'primary' : 'preload');
              if (oldActive !== loadTarget) oldActive.pause();
              isLoadingVideoRef.current = false;
            });
            void loadTarget.play();
            loadTarget.addEventListener('emptied', cleanupFrameWait, { once: true });
          } else {
            activeVideoRef.current = loadTarget;
            setActiveVideoSlot(loadTarget === videoRef.current ? 'primary' : 'preload');
            if (oldActive !== loadTarget) oldActive.pause();
            isLoadingVideoRef.current = false;
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

    const active = activeVideoRef.current ?? videoRef.current;
    const preloadTarget = active === videoRef.current ? preloadVideoRef.current : videoRef.current;
    if (!preloadTarget) return;

    preloadedUrlRef.current = nextUrl;
    preloadReadyRef.current = false;
    const clipId = nextClip.id;
    const preloadVideo = preloadTarget;
    const capturePrerenderFrame = () => {
      if (!preloadVideo.videoWidth || !preloadVideo.videoHeight) return;
      const canvas = document.createElement('canvas');
      canvas.width = preloadVideo.videoWidth;
      canvas.height = preloadVideo.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(preloadVideo, 0, 0, canvas.width, canvas.height);
      try {
        setPrerenderedFrame(clipId, canvas.toDataURL('image/png'));
      } catch {
        // CORS などで data URL 化できない場合はプリレンダ保存のみスキップする
      }
    };

    const handleLoadedMetadata = () => {
      preloadVideo.currentTime = nextClip.sourceStartTime;
    };
    const handleSeeked = () => {
      preloadReadyRef.current = true;
      capturePrerenderFrame();
    };
    const handleLoadedData = () => {
      if (!preloadVideo.seeking) {
        preloadReadyRef.current = true;
        capturePrerenderFrame();
      }
    };

    clearPrerenderedFrame(clipId);
    preloadVideo.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
    preloadVideo.addEventListener('seeked', handleSeeked, { once: true });
    preloadVideo.addEventListener('loadeddata', handleLoadedData, { once: true });
    preloadVideo.src = nextUrl;
    preloadVideo.load();

    return () => {
      preloadVideo.removeEventListener('loadedmetadata', handleLoadedMetadata);
      preloadVideo.removeEventListener('seeked', handleSeeked);
      preloadVideo.removeEventListener('loadeddata', handleLoadedData);
    };
  }, [
    clearPrerenderedFrame,
    currentClip,
    findNextClipAfter,
    videoRef,
    setPrerenderedFrame,
    videoUrls,
  ]);

  // 動画ファイルが切り替わったとき src を更新してシーク（停止中のみ）
  useEffect(() => {
    if (!videoRef.current) return;
    if (useVideoPreviewStore.getState().isPlaying) return;
    if (currentVideoUrl === loadedVideoUrl.current) return;

    if (preloadVideoRef.current) {
      preloadVideoRef.current.pause();
    }
    activeVideoRef.current = videoRef.current;
    setActiveVideoSlot('primary');
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
  }, [videoRef, currentTimeRef, currentVideoUrl, timelineTimeToSourceTime, setDuration]);

  return {
    preloadVideoRef,
    activeVideoRef,
    activeVideoSlot,
    loadedVideoUrl,
    isLoadingVideoRef,
    switchVideo,
  };
};
