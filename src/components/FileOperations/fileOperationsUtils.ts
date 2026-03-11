import type { Track } from '../../store/timelineStore';

export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'aac', 'ogg', 'm4a', 'flac', 'wma'];

export const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', '3gp'];

/**
 * ファイルパスが音声ファイルかどうか判定する
 */
export const isAudioFile = (filePath: string): boolean => {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return AUDIO_EXTENSIONS.includes(ext);
};

/**
 * 指定タイプの次のトラックIDを生成する
 */
export const getNextTrackId = (existingTracks: Track[], type: 'video' | 'audio'): string => {
  const prefix = type === 'video' ? 'video' : 'audio';
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  const indices = existingTracks
    .filter((track) => track.type === type)
    .map((track) => {
      const match = track.id.match(pattern);
      return match ? Number(match[1]) : 0;
    })
    .filter((value) => Number.isFinite(value));

  const nextIndex = indices.length > 0 ? Math.max(...indices) + 1 : 1;
  return `${prefix}-${nextIndex}`;
};

/**
 * ファイルパスからファイル名を抽出する
 */
export const extractFileName = (fullPath: string): string => {
  return fullPath.split(/[/\\]/).pop() ?? fullPath;
};

/**
 * メディアのdurationを取得する（video/audio要素を使用）
 */
export const getMediaDuration = (url: string, type: 'video' | 'audio'): Promise<number> => {
  return new Promise((resolve, reject) => {
    const element = document.createElement(type);
    element.preload = 'metadata';

    element.onloadedmetadata = () => {
      resolve(element.duration);
    };

    element.onerror = () => {
      const label = type === 'video' ? '動画' : '音声';
      reject(new Error(`${label}のメタデータ読み込みに失敗しました`));
    };

    element.src = url;
  });
};
