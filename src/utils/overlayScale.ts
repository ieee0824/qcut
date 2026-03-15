const PREVIEW_BASE_HEIGHT = 360;
const MIN_FONT_SIZE_PX = 8;

export function getOverlayScale(previewHeight: number): number {
  if (!Number.isFinite(previewHeight) || previewHeight <= 0) return 1;
  return previewHeight / PREVIEW_BASE_HEIGHT;
}

export function scaleOverlayFontSize(fontSize: number, previewHeight: number): number {
  return Math.max(MIN_FONT_SIZE_PX, Math.round(fontSize * getOverlayScale(previewHeight)));
}

export function scaleOverlayPixels(value: number, previewHeight: number): number {
  return Math.round(value * getOverlayScale(previewHeight) * 100) / 100;
}
