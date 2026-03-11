import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { save } from '@tauri-apps/plugin-dialog';
import { useExportStore, DEFAULT_FORMAT_OPTIONS } from '../store/exportStore';
import type { ExportFormat, FormatOption } from '../store/exportStore';
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

// DEFAULT_FORMAT_OPTIONS から導出（単一の真実の源を維持）
// テストは value フィールドを期待するため key -> value にマッピング
const FORMAT_OPTIONS: { label: string; value: ExportFormat; ext: string; filterName: string }[] =
  DEFAULT_FORMAT_OPTIONS.map((opt) => ({ ...opt, value: opt.key }));

/**
 * 残り時間をフォーマットして返す純粋関数。
 * @param elapsed 経過時間（秒）
 * @param progress 進捗率（0〜1）
 * @param labels ラベル文字列 { remaining, seconds, minutes, hours }
 * @returns フォーマットされた残り時間文字列、または null
 */
export function formatEstimatedRemaining(
  elapsed: number,
  progress: number,
  labels: { remaining: string; seconds: string; minutes: string; hours: string },
): string | null {
  if (progress <= 0) return null;
  if (elapsed < 2) return null;
  const remaining = elapsed * (1 - progress) / progress;
  if (remaining < 60) return `${labels.remaining}: ${Math.round(remaining)}${labels.seconds}`;
  if (remaining < 3600) return `${labels.remaining}: ${Math.round(remaining / 60)}${labels.minutes}`;
  const h = Math.floor(remaining / 3600);
  const m = Math.round((remaining % 3600) / 60);
  return `${labels.remaining}: ${h}${labels.hours}${m}${labels.minutes}`;
}

/**
 * RESOLUTION_OPTIONS から一致するインデックスを返す。
 */
export function findResolutionIndex(width: number, height: number): number {
  return RESOLUTION_OPTIONS.findIndex((o) => o.width === width && o.height === height);
}

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
    formatOptions,
    setFormatOptions,
  } = useExportStore();
  const tracks = useTimelineStore((s) => s.tracks);
  const duration = useTimelineStore((s) => s.duration);
  const previewContainerHeight = useVideoPreviewStore((s) => s.previewContainerHeight);

  // バックエンドからエクスポートフォーマット一覧を取得
  useEffect(() => {
    invoke<FormatOption[]>('get_export_formats')
      .then((options) => setFormatOptions(options))
      .catch(() => { /* フォールバックとしてデフォルト値を維持 */ });
  }, [setFormatOptions]);

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
    const fmt = formatOptions.find((f) => f.key === settings.format) ?? formatOptions[0];
    const path = await save({
      defaultPath: `output.${fmt.ext}`,
      filters: [{ name: fmt.filterName, extensions: [fmt.ext] }],
    });
    if (path) setOutputPath(path);
  }, [setOutputPath, settings.format, formatOptions]);

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
    return formatEstimatedRemaining(elapsed, progress, {
      remaining: t('export.remaining'),
      seconds: t('export.seconds'),
      minutes: t('export.minutes'),
      hours: t('export.hours'),
    });
  }, [exportStartedAt, progress, t]);

  const resolutionIndex = findResolutionIndex(settings.width, settings.height);

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
    formatOptions,
    handleSelectOutput,
    handleStartExport,
    handleCancel,
    handleClose,
    handleResolutionChange,
  };
}
