export interface HistogramData {
  r: Uint32Array;
  g: Uint32Array;
  b: Uint32Array;
  luma: Uint32Array;
}

/**
 * ピクセルデータからRGB + 輝度のヒストグラムを計算する。
 * パフォーマンスのため step ピクセルごとにサンプリングする。
 */
export function computeHistogram(
  pixels: Uint8ClampedArray | Uint8Array,
  step: number = 4,
): HistogramData {
  const r = new Uint32Array(256);
  const g = new Uint32Array(256);
  const b = new Uint32Array(256);
  const luma = new Uint32Array(256);

  const stride = step * 4;
  for (let i = 0; i < pixels.length; i += stride) {
    const rv = pixels[i];
    const gv = pixels[i + 1];
    const bv = pixels[i + 2];
    r[rv]++;
    g[gv]++;
    b[bv]++;
    // ITU-R BT.709 luma
    const y = (rv * 54 + gv * 183 + bv * 19) >> 8;
    luma[y]++;
  }

  return { r, g, b, luma };
}
