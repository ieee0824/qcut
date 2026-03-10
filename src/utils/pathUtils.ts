/**
 * パスユーティリティ
 * プロジェクトファイル保存時の相対パス変換・読み込み時の絶対パス復元に使用
 */

/** パスが絶対パスかどうかを判定する（Unix: / 始まり、Windows: C:\ 始まり） */
export function isAbsolutePath(path: string): boolean {
  if (!path) return false;
  // Unix absolute path
  if (path.startsWith('/')) return true;
  // Windows absolute path (e.g., C:\, D:\)
  if (/^[A-Za-z]:[/\\]/.test(path)) return true;
  return false;
}

/** ファイルパスからディレクトリ部分を取得する */
export function getDirectoryPath(filePath: string): string {
  // Windows のバックスラッシュも考慮
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  if (lastSlash < 0) return '';
  if (lastSlash === 0) return '/';
  // Windows: "C:\file.qcut" → lastSlash=2, ディレクトリは "C:\"
  const driveMatch = filePath.match(/^[A-Za-z]:[/\\]/);
  if (driveMatch && lastSlash <= 2) {
    return driveMatch[0];
  }
  return filePath.substring(0, lastSlash);
}

/**
 * パスをスラッシュ区切りのセグメントに正規化する
 * 内部処理用: Windows バックスラッシュをスラッシュに統一
 */
function normalizeToSegments(path: string): string[] {
  return path.replace(/\\/g, '/').split('/').filter(Boolean);
}

/**
 * 絶対パスを相対パスに変換する
 * @param filePath 変換対象の絶対パス
 * @param baseDir 基準ディレクトリの絶対パス
 * @returns 相対パス（スラッシュ区切り）。異なるドライブの場合は絶対パスのまま返す
 */
export function toRelativePath(filePath: string, baseDir: string): string {
  if (!filePath) return '';

  // Windows: 異なるドライブレターの場合は絶対パスのまま返す
  const fileDrive = filePath.match(/^([A-Za-z]):[/\\]/)?.[1]?.toUpperCase();
  const baseDrive = baseDir.match(/^([A-Za-z]):[/\\]/)?.[1]?.toUpperCase();
  if (fileDrive && baseDrive && fileDrive !== baseDrive) {
    return filePath;
  }

  const fileSegments = normalizeToSegments(filePath);
  const baseSegments = normalizeToSegments(baseDir);

  // 共通プレフィックスの長さを求める
  let commonLength = 0;
  while (
    commonLength < fileSegments.length &&
    commonLength < baseSegments.length &&
    fileSegments[commonLength] === baseSegments[commonLength]
  ) {
    commonLength++;
  }

  // baseDir から共通部分まで遡る分の ../
  const upCount = baseSegments.length - commonLength;
  const upSegments = Array(upCount).fill('..');
  const remainingSegments = fileSegments.slice(commonLength);

  return [...upSegments, ...remainingSegments].join('/');
}

/**
 * 相対パスを絶対パスに解決する
 * 絶対パスが渡された場合はそのまま返す（後方互換性）
 * @param filePath 相対パスまたは絶対パス
 * @param baseDir 基準ディレクトリの絶対パス
 * @returns 絶対パス
 */
export function resolveRelativePath(filePath: string, baseDir: string): string {
  if (!filePath) return '';

  // 既に絶対パスならそのまま返す（後方互換性）
  if (isAbsolutePath(filePath)) return filePath;

  // baseDir が Windows パスかどうかを判定
  const isWindows = /^[A-Za-z]:[/\\]/.test(baseDir);
  const separator = isWindows ? '\\' : '/';

  // baseDir のセグメント + 相対パスのセグメントを結合
  const baseSegments = normalizeToSegments(baseDir);
  const relSegments = filePath.replace(/\\/g, '/').split('/');

  const resultSegments = [...baseSegments];
  for (const segment of relSegments) {
    if (segment === '..') {
      resultSegments.pop();
    } else if (segment !== '.' && segment !== '') {
      resultSegments.push(segment);
    }
  }

  // パスの先頭を復元
  if (isWindows) {
    // 最初のセグメントはドライブレター (e.g., "C:")
    return resultSegments.join(separator);
  }
  return '/' + resultSegments.join(separator);
}
