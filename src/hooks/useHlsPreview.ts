import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTimelineStore } from '../store/timelineStore';
import { useHlsPreviewStore, type HlsSegment } from '../store/hlsPreviewStore';

const DEBOUNCE_MS = 1500;

interface HlsClipInput {
  file_path: string;
  source_start_time: number;
  source_end_time: number;
  timeline_start: number;
}

interface HlsResult {
  playlist_path: string;
  segments: Array<{ hls_start: number; timeline_start: number; duration: number }>;
}

export function useHlsPreview() {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const scheduleGeneration = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(async () => {
        const tracks = useTimelineStore.getState().tracks;
        const clips: HlsClipInput[] = [];

        for (const track of tracks) {
          if (track.type !== 'video') continue;
          for (const clip of track.clips) {
            if (!clip.filePath) continue;
            clips.push({
              file_path: clip.filePath,
              source_start_time: clip.sourceStartTime,
              source_end_time: clip.sourceEndTime,
              timeline_start: clip.startTime,
            });
          }
        }

        if (clips.length === 0) {
          useHlsPreviewStore.getState().reset();
          return;
        }

        useHlsPreviewStore.getState().setIsGenerating(true);
        try {
          const result = await invoke<HlsResult>('generate_preview_hls', { clips });
          const segments: HlsSegment[] = result.segments.map((s) => ({
            hlsStart: s.hls_start,
            timelineStart: s.timeline_start,
            duration: s.duration,
          }));
          useHlsPreviewStore.getState().setHlsReady(result.playlist_path, segments);
        } catch (e) {
          useHlsPreviewStore.getState().setError(String(e));
        }
      }, DEBOUNCE_MS);
    };

    // ビデオトラックのクリップ変化を購読
    const unsubscribe = useTimelineStore.subscribe((state, prev) => {
      const videoTracks = (t: typeof state) => t.tracks.filter((tr) => tr.type === 'video');
      if (JSON.stringify(videoTracks(state)) !== JSON.stringify(videoTracks(prev))) {
        scheduleGeneration();
      }
    });

    // 初回生成
    scheduleGeneration();

    return () => {
      unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);
}
