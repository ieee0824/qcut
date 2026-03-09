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

  const safeStep = Math.max(1, Math.round(step));
  const stride = safeStep * 4;
  const limit = pixels.length - 3;
  for (let i = 0; i < limit; i += stride) {
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

/**
 * ベクトルスコープ用データ。
 * Cb/Cr 平面上の密度マップ（256x256）。
 */
export interface VectorscopeData {
  /** 256x256 の密度マップ。[cr * 256 + cb] でアクセス */
  density: Uint32Array;
  /** 密度の最大値（描画時の正規化用） */
  peak: number;
}

/**
 * ピクセルデータからベクトルスコープ（Cb/Cr密度マップ）を計算する。
 * ITU-R BT.709 の RGB→YCbCr 変換を使用。
 */
export function computeVectorscope(
  pixels: Uint8ClampedArray | Uint8Array,
  step: number = 4,
): VectorscopeData {
  const density = new Uint32Array(256 * 256);

  const safeStep = Math.max(1, Math.round(step));
  const stride = safeStep * 4;
  const limit = pixels.length - 3;
  let peak = 0;

  for (let i = 0; i < limit; i += stride) {
    const rv = pixels[i];
    const gv = pixels[i + 1];
    const bv = pixels[i + 2];

    // BT.709: Cb = -0.169R - 0.331G + 0.500B + 128
    //         Cr =  0.500R - 0.419G - 0.081B + 128
    // 整数近似（×256してシフト）
    const cb = ((-43 * rv - 85 * gv + 128 * bv) >> 8) + 128;
    const cr = ((128 * rv - 107 * gv - 21 * bv) >> 8) + 128;

    // クランプ
    const cbClamped = cb < 0 ? 0 : cb > 255 ? 255 : cb;
    const crClamped = cr < 0 ? 0 : cr > 255 ? 255 : cr;

    const idx = crClamped * 256 + cbClamped;
    density[idx]++;
    if (density[idx] > peak) peak = density[idx];
  }

  return { density, peak };
}

/**
 * 波形モニター用データ。
 * 各カラム（x座標）ごとの輝度分布。
 */
export interface WaveformData {
  /** columns x 256 の密度マップ。[x * 256 + luma] でアクセス */
  density: Uint32Array;
  /** 密度の最大値 */
  peak: number;
  /** カラム数（元画像の幅） */
  columns: number;
}

/**
 * ピクセルデータから波形モニター（各カラムの輝度分布）を計算する。
 * width はソース画像の幅（ピクセルデータの行あたりピクセル数）。
 */
export function computeWaveform(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  step: number = 1,
): WaveformData {
  const safeStep = Math.max(1, Math.round(step));
  const density = new Uint32Array(width * 256);
  let peak = 0;

  const stride = safeStep * 4;
  const limit = pixels.length - 3;
  const rowStride = width * 4;

  for (let i = 0; i < limit; i += stride) {
    const rv = pixels[i];
    const gv = pixels[i + 1];
    const bv = pixels[i + 2];
    // ITU-R BT.709 luma
    const y = (rv * 54 + gv * 183 + bv * 19) >> 8;
    // x座標 = (i % rowStride) / 4
    const col = ((i % rowStride) / 4) | 0;
    const idx = col * 256 + y;
    density[idx]++;
    if (density[idx] > peak) peak = density[idx];
  }

  return { density, peak, columns: width };
}
