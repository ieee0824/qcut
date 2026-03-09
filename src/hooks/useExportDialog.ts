import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { save } from '@tauri-apps/plugin-dialog';
import { useExportStore, ExportFormat } from '../store/exportStore';
import { useTimelineStore } from '../store/timelineStore';
import { useVideoPreviewStore } from '../store/videoPreviewStore';

interface ExportProgressPayload {
  progress: number;
  currentTime: number;
  status: string;
  message: string;
}

const RESOLUTION_OPTIONS = [
  { label: '1920 x 1080 (Full HD)', width: 1920, height: 1080 },
  { label: '1280 x 720 (HD)', width: 1280, height: 720 },
  { label: '854 x 480 (SD)', width: 854, height: 480 },
];

const FPS_OPTIONS = [24, 30, 60];

const BITRATE_OPTIONS = [
  { label: '4 Mbps', value: '4M' },
  { label: '8 Mbps', value: '8M' },
  { label: '12 Mbps', value: '12M' },
  { label: '20 Mbps', value: '20M' },
];

const FORMAT_OPTIONS: { label: string; value: ExportFormat; ext: string; filterName: string }[] = [
  { label: 'MP4 (H.264)', value: 'mp4', ext: 'mp4', filterName: 'MP4' },
  { label: 'MOV (H.264)', value: 'mov', ext: 'mov', filterName: 'MOV' },
  { label: 'AVI (H.264)', value: 'avi', ext: 'avi', filterName: 'AVI' },
  { label: 'WebM (VP9)', value: 'webm', ext: 'webm', filterName: 'WebM' },
];

export { RESOLUTION_OPTIONS, FPS_OPTIONS, BITRATE_OPTIONS, FORMAT_OPTIONS };

export function useExportDialog() {
  const { t } = useTranslation();
  const {
    status,
    progress,
    errorMessage,
    isDialogOpen,
    settings,
    outputPath,
    setStatus,
    setProgress,
    setError,
    setDialogOpen,
    setSettings,
    setOutputPath,
    reset,
    exportStartedAt,
  } = useExportStore();
  const tracks = useTimelineStore((s) => s.tracks);
  const duration = useTimelineStore((s) => s.duration);
  const previewContainerHeight = useVideoPreviewStore((s) => s.previewContainerHeight);

  // バックエンドからの進捗イベントをリッスン
  useEffect(() => {
    if (status !== 'exporting') return;

    const unlistenPromise = listen<ExportProgressPayload>('export-progress', (event) => {
      const { progress: p, currentTime, status: s, message } = event.payload;
      if (s === 'complete') {
        setStatus('complete');
      } else if (s === 'error') {
        setError(message);
      } else if (s === 'cancelled') {
        setStatus('cancelled');
      } else {
        setProgress(p, currentTime);
      }
    });

    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [status, setStatus, setProgress, setError]);

  const handleSelectOutput = useCallback(async () => {
    const fmt = FORMAT_OPTIONS.find((f) => f.value === settings.format) ?? FORMAT_OPTIONS[0];
    const path = await save({
      defaultPath: `output.${fmt.ext}`,
      filters: [{ name: fmt.filterName, extensions: [fmt.ext] }],
    });
    if (path) setOutputPath(path);
  }, [setOutputPath, settings.format]);

  const handleStartExport = useCallback(async () => {
    if (!outputPath) return;

    const videoClipCount = tracks
      .filter((t) => t.type === 'video')
      .reduce((sum, t) => sum + t.clips.length, 0);
    if (videoClipCount === 0) {
      setError(t('export.noClips'));
      return;
    }

    setStatus('exporting');
    setProgress(0, 0);

    try {
      await invoke('export_video', {
        settings: {
          ...settings,
          outputPath,
          tracks,
          totalDuration: duration,
          previewHeight: previewContainerHeight > 0 ? previewContainerHeight : settings.height,
        },
      });
    } catch (e) {
      setError(String(e));
    }
  }, [outputPath, settings, tracks, duration, previewContainerHeight, setStatus, setProgress, setError, t]);

  const handleCancel = useCallback(async () => {
    try {
      await invoke('cancel_export');
    } catch (e) {
      console.error('キャンセルに失敗:', e);
    }
  }, []);

  const handleClose = useCallback(() => {
    reset();
    setDialogOpen(false);
  }, [reset, setDialogOpen]);

  const handleResolutionChange = useCallback(
    (e: React.ChangeEvent<globalThis.HTMLSelectElement>) => {
      const opt = RESOLUTION_OPTIONS[Number(e.target.value)];
      setSettings({ width: opt.width, height: opt.height });
    },
    [setSettings],
  );

  const estimatedRemaining = useMemo(() => {
    if (!exportStartedAt || progress <= 0) return null;
    const elapsed = (Date.now() - exportStartedAt) / 1000;
    if (elapsed < 2) return null; // 最初の2秒はデータ不足
    const remaining = elapsed * (1 - progress) / progress;
    if (remaining < 60) return `${t('export.remaining')}: ${Math.round(remaining)}${t('export.seconds')}`;
    if (remaining < 3600) return `${t('export.remaining')}: ${Math.round(remaining / 60)}${t('export.minutes')}`;
    const h = Math.floor(remaining / 3600);
    const m = Math.round((remaining % 3600) / 60);
    return `${t('export.remaining')}: ${h}${t('export.hours')}${m}${t('export.minutes')}`;
  }, [exportStartedAt, progress, t]);

  const resolutionIndex = RESOLUTION_OPTIONS.findIndex(
    (o) => o.width === settings.width && o.height === settings.height,
  );

  return {
    t,
    status,
    progress,
    errorMessage,
    isDialogOpen,
    settings,
    outputPath,
    setSettings,
    resolutionIndex,
    estimatedRemaining,
    handleSelectOutput,
    handleStartExport,
    handleCancel,
    handleClose,
    handleResolutionChange,
  };
}
