/**
 * Clip コンポーネントおよび関連フック内で使われる純粋な計算ロジック
 */

/**
 * ドラッグ移動量（ピクセル）からクリップの新しい開始時間を計算する。
 * 結果は 0 以上にクランプされる。
 */
export function calculateDragNewStartTime(
  dragStartTime: number,
  deltaX: number,
  pixelsPerSecond: number,
): number {
  const deltaTime = deltaX / pixelsPerSecond;
  return Math.max(0, dragStartTime + deltaTime);
}

/**
 * クリップの startTime と duration からピクセル座標の left / width を計算する。
 */
export function calculateClipPosition(
  startTime: number,
  duration: number,
  pixelsPerSecond: number,
): { left: number; width: number } {
  return {
    left: startTime * pixelsPerSecond,
    width: duration * pixelsPerSecond,
  };
}

/**
 * 右クリック位置からプレイヘッドに設定する絶対時間を計算する。
 * relativeX はクリップ要素左端からのクリック座標。
 */
export function calculateContextMenuTime(
  clipStartTime: number,
  clipDuration: number,
  relativeX: number,
  pixelsPerSecond: number,
): number {
  const relTime = relativeX / pixelsPerSecond;
  return clipStartTime + Math.max(0, Math.min(relTime, clipDuration));
}

/**
 * コンテキストメニューの表示位置をビューポート内に収まるよう補正する。
 */
export function clampMenuPosition(
  position: { x: number; y: number },
  menuWidth: number,
  menuHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  let { x, y } = position;
  if (x + menuWidth > viewportWidth) {
    x = viewportWidth - menuWidth;
  }
  if (y + menuHeight > viewportHeight) {
    y = viewportHeight - menuHeight;
  }
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  return { x, y };
}
