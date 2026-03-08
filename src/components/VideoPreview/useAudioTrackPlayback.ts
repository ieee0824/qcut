import { useEffect, useRef, useCallback } from 'react';
import { useTimelineStore, Clip, DEFAULT_EFFECTS } from '../../store/timelineStore';
import { useVideoPreviewStore } from '../../store/videoPreviewStore';
import { audioEngine } from '../../audio/AudioEngine';

interface AudioEntry {
  audio: globalThis.HTMLAudioElement;
  clipId: string;
  filePath: string;
}

/**
 * 音声トラックのクリップをプレビュー再生するフック。
 * Web Audio API を使って EQ・ハイパス・エコー・リバーブをリアルタイムに反映する。
 * タイムライン上の currentTime に合わせて Audio 要素を再生/停止/シークする。
 */
export const useAudioTrackPlayback = () => {
  // clipId → AudioEntry のマップ
  const audioMapRef = useRef<Map<string, AudioEntry>>(new Map());
  const rafRef = useRef<number | null>(null);

  // 音声トラックのクリップ一覧を取得（トラックレベルの volume/mute 情報付き）
  const getAudioClips = useCallback((): (Clip & { trackId: string; trackVolume: number; trackMuted: boolean })[] => {
    const tracks = useTimelineStore.getState().tracks;
    const hasSolo = tracks.some(t => t.solo);
    const result: (Clip & { trackId: string; trackVolume: number; trackMuted: boolean })[] = [];
    for (const track of tracks) {
      if (track.type === 'audio') {
        // ソロモード: ソロが1つでもあれば、ソロでないトラックはミュート扱い
        const isMuted = track.mute || (hasSolo && !track.solo);
        for (const clip of track.clips) {
          result.push({ ...clip, trackId: track.id, trackVolume: track.volume, trackMuted: isMuted });
        }
      }
    }
    return result;
  }, []);

  // Audio 要素を取得（なければ作成し、AudioEngine に接続）
  const getOrCreateAudio = useCallback((clip: Clip): AudioEntry => {
    const existing = audioMapRef.current.get(clip.id);
    if (existing && existing.filePath === clip.filePath) {
      // AudioEngine にまだ接続されていなければ接続
      if (!audioEngine.hasGraph(clip.id)) {
        audioEngine.connect(clip.id, existing.audio);
      }
      return existing;
    }

    // 古い要素があれば破棄
    if (existing) {
      audioEngine.disconnect(clip.id);
      existing.audio.pause();
      existing.audio.src = '';
    }

    const audio = new window.Audio();
    audio.crossOrigin = 'anonymous';
    const videoUrls = useVideoPreviewStore.getState().videoUrls;
    const url = videoUrls[clip.filePath];
    if (url) {
      audio.src = url;
    } else {
      // asset プロトコルで直接アクセス
      audio.src = `asset://localhost/${encodeURIComponent(clip.filePath)}`;
    }
    audio.preload = 'auto';

    // Web Audio API に接続（AudioContext 経由で音声出力するため volume は 1 固定）
    audioEngine.connect(clip.id, audio);

    const entry: AudioEntry = { audio, clipId: clip.id, filePath: clip.filePath };
    audioMapRef.current.set(clip.id, entry);
    return entry;
  }, []);

  // 指定時刻でアクティブな音声クリップを同期再生
  const syncAudio = useCallback((currentTime: number, isPlaying: boolean) => {
    const audioClips = getAudioClips();
    const uiVolume = useVideoPreviewStore.getState().volume / 100;
    const activeIds = new Set<string>();

    for (const clip of audioClips) {
      const clipEnd = clip.startTime + clip.duration;
      const isActive = currentTime >= clip.startTime && currentTime < clipEnd;

      if (isActive) {
        activeIds.add(clip.id);
        const entry = getOrCreateAudio(clip);
        const { audio } = entry;

        // ソース時刻を計算
        const relativeTime = currentTime - clip.startTime;
        const sourceTime = clip.sourceStartTime + relativeTime;

        // 合成ボリュームを計算（トラックミュート + トラック音量 + エフェクト + フェード + UI音量）
        let combinedVolume: number;
        if (clip.trackMuted) {
          combinedVolume = 0;
        } else {
          const clipVolume = clip.effects?.volume ?? 1.0;
          const trackVol = clip.trackVolume;
          const fadeIn = clip.effects?.fadeIn ?? 0;
          const fadeOut = clip.effects?.fadeOut ?? 0;
          let audioFade = 1;
          if (fadeIn > 0 && relativeTime < fadeIn) {
            audioFade = Math.min(audioFade, relativeTime / fadeIn);
          }
          const remaining = clipEnd - currentTime;
          if (fadeOut > 0 && remaining < fadeOut) {
            audioFade = Math.min(audioFade, remaining / fadeOut);
          }
          combinedVolume = Math.max(0, Math.min(1, uiVolume * trackVol * clipVolume * audioFade));
        }

        // AudioEngine でエフェクトとボリュームを更新
        const effects = clip.effects ?? DEFAULT_EFFECTS;
        audioEngine.updateEffects(clip.id, effects, combinedVolume);

        if (isPlaying) {
          // 再生位置が大きくずれていたらシーク
          if (Math.abs(audio.currentTime - sourceTime) > 0.3) {
            audio.currentTime = sourceTime;
          }
          if (audio.paused) {
            audio.play().catch(() => {});
          }
        } else {
          if (!audio.paused) {
            audio.pause();
          }
          audio.currentTime = sourceTime;
        }
      }
    }

    // アクティブでないクリップのAudioを停止
    for (const [clipId, entry] of audioMapRef.current) {
      if (!activeIds.has(clipId)) {
        if (!entry.audio.paused) {
          entry.audio.pause();
        }
      }
    }
  }, [getAudioClips, getOrCreateAudio]);

  // 再生中は RAF で同期を回す
  useEffect(() => {
    const unsubPlaying = useVideoPreviewStore.subscribe((state, prevState) => {
      if (state.isPlaying === prevState.isPlaying) return;

      if (state.isPlaying) {
        // 再生開始 → RAF ループ
        const tick = () => {
          const currentTime = useTimelineStore.getState().currentTime;
          syncAudio(currentTime, true);
          rafRef.current = window.requestAnimationFrame(tick);
        };
        rafRef.current = window.requestAnimationFrame(tick);
      } else {
        // 停止
        if (rafRef.current !== null) {
          window.cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        const currentTime = useTimelineStore.getState().currentTime;
        syncAudio(currentTime, false);
      }
    });

    // シーク時の同期（停止中）
    const unsubTimeline = useTimelineStore.subscribe((state, prevState) => {
      if (useVideoPreviewStore.getState().isPlaying) return;
      if (state.currentTime !== prevState.currentTime) {
        syncAudio(state.currentTime, false);
      }
    });

    const audioMap = audioMapRef.current;
    return () => {
      unsubPlaying();
      unsubTimeline();
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      // 全 Audio 要素を破棄
      for (const [clipId, entry] of audioMap) {
        audioEngine.disconnect(clipId);
        entry.audio.pause();
        entry.audio.src = '';
      }
      audioMap.clear();
    };
  }, [syncAudio]);

  // トラック構成が変わったら不要な Audio を破棄
  useEffect(() => {
    return useTimelineStore.subscribe((state) => {
      const audioClipIds = new Set<string>();
      for (const track of state.tracks) {
        if (track.type === 'audio') {
          for (const clip of track.clips) {
            audioClipIds.add(clip.id);
          }
        }
      }
      for (const [clipId, entry] of audioMapRef.current) {
        if (!audioClipIds.has(clipId)) {
          audioEngine.disconnect(clipId);
          entry.audio.pause();
          entry.audio.src = '';
          audioMapRef.current.delete(clipId);
        }
      }
    });
  }, []);
};
