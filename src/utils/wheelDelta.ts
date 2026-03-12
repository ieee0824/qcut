/** WheelEvent の deltaY をピクセル単位に正規化する */
export function normalizeWheelDelta(deltaY: number, deltaMode: number, viewportHeight: number): number {
  if (deltaMode === 1) return deltaY * 16;            // DOM_DELTA_LINE
  if (deltaMode === 2) return deltaY * viewportHeight; // DOM_DELTA_PAGE
  return deltaY;                                       // DOM_DELTA_PIXEL
}
