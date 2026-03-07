import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVideoPreviewStore } from '../../store/videoPreviewStore';
import { useTimelineStore } from '../../store/timelineStore';
import type { Clip as ClipType, TextProperties, TransitionType } from '../../store/timelineStore';

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
  const transitionVideoRef = useRef<HTMLVideoElement>(null);
  const preloadVideoRef = useRef<HTMLVideoElement>(null);
  const preloadedUrlRef = useRef<string>('');
  const loadedVideoUrl = useRef<string | null>(null);
  const loadedTransitionVideoUrl = useRef<string | null>(null);
  const currentTimeRef = useRef(0);
  const playbackRafRef = useRef<number | null>(null);
  const lastTimestampRef = useRef(0);
  const timeDisplayRef = useRef<globalThis.HTMLSpanElement>(null);
  const seekBarRef = useRef<HTMLInputElement>(null);
  // 動画ファイル切替中フラグ（load〜loadedmetadata 間）
  const isLoadingVideoRef = useRef(false);
  const isLoadingTransitionVideoRef = useRef(false);
  // トランジション中かどうか
  const isInTransitionRef = useRef(false);

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

  // トランジション区間の検出
  interface TransitionInfo {
    outgoingClip: ClipType;
    incomingClip: ClipType;
    progress: number; // 0→1 (0=outgoing only, 1=incoming only)
    transitionType: TransitionType;
  }

  const findTransitionAtTime = useCallback((time: number): TransitionInfo | null => {
    const currentTracks = useTimelineStore.getState().tracks;
    for (const track of currentTracks) {
      if (track.type !== 'video') continue;
      for (const clip of track.clips) {
        if (!clip.transition) continue;
        const overlapStart = clip.startTime - clip.transition.duration;
        const overlapEnd = clip.startTime;
        if (time >= overlapStart && time < overlapEnd) {
          // outgoing clip = findClipAtTime で取得（overlapStart 位置のクリップ）
          const outgoing = findClipAtTime(time);
          if (!outgoing || outgoing.id === clip.id) continue;
          const progress = (time - overlapStart) / clip.transition.duration;
          return {
            outgoingClip: outgoing,
            incomingClip: clip,
            progress,
            transitionType: clip.transition.type,
          };
        }
      }
    }
    return null;
  }, [findClipAtTime]);

  // トランジション用ビデオの切り替え
  const switchTransitionVideo = useCallback((url: string, sourceTime: number) => {
    if (!transitionVideoRef.current) return;
    if (url === loadedTransitionVideoUrl.current) {
      transitionVideoRef.current.currentTime = sourceTime;
      if (transitionVideoRef.current.paused) {
        transitionVideoRef.current.play();
      }
      return;
    }
    isLoadingTransitionVideoRef.current = true;
    loadedTransitionVideoUrl.current = url;
    transitionVideoRef.current.src = url;
    transitionVideoRef.current.load();
    const videoEl = transitionVideoRef.current;
    videoEl.addEventListener(
      'loadedmetadata',
      () => {
        isLoadingTransitionVideoRef.current = false;
        videoEl.currentTime = sourceTime;
        videoEl.play();
      },
      { once: true },
    );
  }, []);

  // トランジション種類に応じた CSS スタイルを計算
  const getTransitionStyles = useCallback((
    progress: number,
    type: TransitionType,
  ): { outgoing: React.CSSProperties; incoming: React.CSSProperties } => {
    switch (type) {
      case 'crossfade':
      case 'dissolve':
        return {
          outgoing: { opacity: 1 - progress },
          incoming: { opacity: progress },
        };
      case 'wipe-left':
        return {
          outgoing: {},
          incoming: { clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` },
        };
      case 'wipe-right':
        return {
          outgoing: {},
          incoming: { clipPath: `inset(0 0 0 ${(1 - progress) * 100}%)` },
        };
      case 'wipe-up':
        return {
          outgoing: {},
          incoming: { clipPath: `inset(0 0 ${(1 - progress) * 100}% 0)` },
        };
      case 'wipe-down':
        return {
          outgoing: {},
          incoming: { clipPath: `inset(${(1 - progress) * 100}% 0 0 0)` },
        };
      default:
        return {
          outgoing: { opacity: 1 - progress },
          incoming: { opacity: progress },
        };
    }
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

      // --- トランジション判定 ---
      const transition = findTransitionAtTime(currentTimeRef.current);
      if (transition && transitionVideoRef.current) {
        isInTransitionRef.current = true;
        const { outgoingClip, incomingClip, progress, transitionType } = transition;
        const urls = useVideoPreviewStore.getState().videoUrls;

        // outgoing clip → videoRef
        const outUrl = urls[outgoingClip.filePath];
        if (outUrl && outUrl !== loadedVideoUrl.current && !isLoadingVideoRef.current) {
          const srcTime = outgoingClip.sourceStartTime + (currentTimeRef.current - outgoingClip.startTime);
          switchVideo(outUrl, srcTime, true);
        }

        // incoming clip → transitionVideoRef
        const inUrl = urls[incomingClip.filePath];
        const incomingSourceTime = incomingClip.sourceStartTime + (currentTimeRef.current - (incomingClip.startTime - incomingClip.transition!.duration));
        if (inUrl && inUrl !== loadedTransitionVideoUrl.current && !isLoadingTransitionVideoRef.current) {
          switchTransitionVideo(inUrl, incomingSourceTime);
        }

        // CSS スタイルを直接更新（レンダー不要）
        const styles = getTransitionStyles(progress, transitionType);
        videoRef.current.style.opacity = styles.outgoing.opacity !== undefined ? String(styles.outgoing.opacity) : '1';
        videoRef.current.style.clipPath = (styles.outgoing as Record<string, string>).clipPath || '';
        transitionVideoRef.current.style.visibility = 'visible';
        transitionVideoRef.current.style.opacity = styles.incoming.opacity !== undefined ? String(styles.incoming.opacity) : '1';
        transitionVideoRef.current.style.clipPath = (styles.incoming as Record<string, string>).clipPath || '';

        // delta で時間を進める
        const newTime = currentTimeRef.current + delta;
        currentTimeRef.current = newTime;
        useTimelineStore.getState().setCurrentTime(newTime);
        updateTimeDisplay(newTime);

        playbackRafRef.current = window.requestAnimationFrame(tick);
        return;
      }

      // トランジション終了時のクリーンアップ
      if (isInTransitionRef.current) {
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
          if (url && url !== loadedVideoUrl.current) {
            const sourceTime = clip.sourceStartTime + (currentTimeRef.current - clip.startTime);
            switchVideo(url, sourceTime, true);
          }
        }
      }

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

          // クリップの音量エフェクトを適用
          const clipVolume = clip.effects?.volume ?? 1.0;
          const uiVolume = useVideoPreviewStore.getState().volume / 100;
          videoRef.current.volume = Math.max(0, Math.min(1, uiVolume * clipVolume));
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
  }, [stopPlaybackLoop, findClipAtTime, findNextClipAfter, findTransitionAtTime, switchVideo, switchTransitionVideo, getTransitionStyles, updateTimeDisplay, setIsPlaying]);

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

  // 現在時刻に表示すべきテキストオーバーレイを取得
  const findTextClipsAtTime = useCallback((time: number): ClipType[] => {
    const currentTracks = useTimelineStore.getState().tracks;
    const results: ClipType[] = [];
    for (const track of currentTracks) {
      if (track.type === 'text') {
        for (const clip of track.clips) {
          if (time >= clip.startTime && time < clip.startTime + clip.duration && clip.textProperties) {
            results.push(clip);
          }
        }
      }
    }
    return results;
  }, []);

  // テキストオーバーレイのアニメーション opacity を計算
  const calcTextOpacity = useCallback((tp: TextProperties, elapsed: number, clipDuration: number): number => {
    const dur = tp.animationDuration;
    let opacity = tp.opacity;
    if (tp.animation === 'fadeIn' || tp.animation === 'fadeInOut') {
      if (elapsed < dur) opacity *= elapsed / dur;
    }
    if (tp.animation === 'fadeOut' || tp.animation === 'fadeInOut') {
      const remaining = clipDuration - elapsed;
      if (remaining < dur) opacity *= remaining / dur;
    }
    return Math.max(0, Math.min(1, opacity));
  }, []);

  // テキストオーバーレイのアニメーション translateY を計算
  const calcTextTranslateY = useCallback((tp: TextProperties, elapsed: number, _clipDuration: number): number => {
    const dur = tp.animationDuration;
    if (tp.animation === 'slideUp') {
      if (elapsed < dur) return 20 * (1 - elapsed / dur);
    }
    if (tp.animation === 'slideDown') {
      if (elapsed < dur) return -20 * (1 - elapsed / dur);
    }
    return 0;
  }, []);

  // テキストオーバーレイ用の state（currentTime 変更時に更新）
  const [textOverlays, setTextOverlays] = useState<ClipType[]>([]);
  const [textCurrentTime, setTextCurrentTime] = useState(0);

  useEffect(() => {
    const updateTextOverlays = (time: number) => {
      const clips = findTextClipsAtTime(time);
      setTextOverlays(clips);
      setTextCurrentTime(time);
    };
    updateTextOverlays(useTimelineStore.getState().currentTime);
    return useTimelineStore.subscribe((state) => {
      updateTextOverlays(state.currentTime);
    });
  }, [tracks, findTextClipsAtTime]);

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
      // トランジション用ビデオもクリーンアップ
      if (transitionVideoRef.current) {
        transitionVideoRef.current.pause();
        transitionVideoRef.current.style.visibility = 'hidden';
      }
      if (isInTransitionRef.current) {
        isInTransitionRef.current = false;
        videoRef.current.style.opacity = '1';
        videoRef.current.style.clipPath = '';
      }
      // 停止時にストアを同期
      setVideoPreviewCurrentTime(currentTimeRef.current);
    }
  }, [isPlaying, startPlaybackLoop, stopPlaybackLoop, setVideoPreviewCurrentTime]);

  // 音量の同期（UI音量 × クリップ音量エフェクト）
  useEffect(() => {
    if (videoRef.current) {
      const clip = findClipAtTime(currentTimeRef.current);
      const clipVolume = clip?.effects?.volume ?? 1.0;
      videoRef.current.volume = Math.max(0, Math.min(1, (volume / 100) * clipVolume));
    }
  }, [volume, findClipAtTime]);

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
