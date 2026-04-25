/**
 * ファイルパスからファイル名を取得する。
 * Unix / Windows 両方のセパレータに対応。パスが空や undefined なら fallback を返す。
 */
export function extractDisplayName(path: string | undefined, fallback: string): string {
  if (!path) return fallback;
  const filename = path.split('/').pop()?.split('\\').pop();
  return filename || fallback;
}

/**
 * ファイルパスから .qcut 拡張子を除去したプロジェクト名を取得する。
 * パスが空・null・undefined なら fallback を返す。
 */
export function extractProjectName(path: string | undefined | null, fallback: string): string {
  if (!path) return fallback;
  const filename = path.split('/').pop()?.split('\\').pop();
  if (!filename) return fallback;
  const name = filename.replace(/\.qcut$/, '');
  return name || fallback;
}
