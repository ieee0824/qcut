/**
 * トランジションインジケーターの位置とサイズを計算する純粋関数。
 */
export function computeIndicatorLayout(
  transitionDuration: number,
  pixelsPerSecond: number,
  clipStartTime: number,
): { width: number; left: number } {
  const width = transitionDuration * pixelsPerSecond;
  const left = clipStartTime * pixelsPerSecond - width / 2;
  return { width, left };
}
