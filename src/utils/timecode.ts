import type { TimecodeFormat } from '../store/timelineStore';

/**
 * クリップの再生位置から表示用タイムコード文字列を生成する
 * @param startDateTime 開始日時 (epoch ms)
 * @param elapsedSeconds クリップ内の経過秒数
 * @param format タイムコードフォーマット
 */
export function formatTimecode(
  startDateTime: number,
  elapsedSeconds: number,
  format: TimecodeFormat,
): string {
  const currentMs = startDateTime + elapsedSeconds * 1000;
  const date = new Date(currentMs);

  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');

  switch (format) {
    case 'ymd-hm':
      return `${y}年${m}月${d}日 ${hh}:${mm}`;
    case 'md-hm':
      return `${m}月${d}日 ${hh}:${mm}`;
    case 'hms':
      return `${hh}:${mm}:${ss}`;
    case 'hm':
      return `${hh}:${mm}`;
    default:
      return `${hh}:${mm}`;
  }
}
