import type { ToneCurves, ToneCurveKeyframe, CurvePoint, EasingType } from '../store/timeline/types';
import { buildCurveLUT } from './curveSpline';

/** ToneCurves → LUT キャッシュ（同じ制御点配列参照なら再計算しない） */
interface CachedChannelLUTs {
  rgbLUT: Float32Array;
  rLUT: Float32Array;
  gLUT: Float32Array;
  bLUT: Float32Array;
}

const _lutCache = new WeakMap<CurvePoint[], Float32Array>();

function getCachedLUT(points: CurvePoint[]): Float32Array {
  let lut = _lutCache.get(points);
  if (!lut) {
    lut = buildCurveLUT(points);
    _lutCache.set(points, lut);
  }
  return lut;
}

function buildCachedChannelLUTs(tc: ToneCurves): CachedChannelLUTs {
  return {
    rgbLUT: getCachedLUT(tc.rgb),
    rLUT: getCachedLUT(tc.r),
    gLUT: getCachedLUT(tc.g),
    bLUT: getCachedLUT(tc.b),
  };
}

/** 補間結果: 各チャンネルの LUT を直接保持 */
export interface InterpolatedToneCurves {
  rgb: ToneCurves['rgb'];
  r: ToneCurves['r'];
  g: ToneCurves['g'];
  b: ToneCurves['b'];
  rgbLUT: Float32Array;
  rLUT: Float32Array;
  gLUT: Float32Array;
  bLUT: Float32Array;
}

function applyEasing(t: number, easing: EasingType): number {
  switch (easing) {
    case 'easeIn':    return t * t;
    case 'easeOut':   return t * (2 - t);
    case 'easeInOut': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    default:          return t; // linear
  }
}

/**
 * 2つの LUT を線形補間する。
 * @param lutA 補間元 LUT
 * @param lutB 補間先 LUT
 * @param t 補間係数（0〜1）
 */
export function interpolateToneCurveLUTs(
  lutA: Float32Array,
  lutB: Float32Array,
  t: number,
): Float32Array {
  const size = lutA.length;
  const result = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    result[i] = lutA[i] + (lutB[i] - lutA[i]) * t;
  }
  return result;
}

/**
 * トーンカーブキーフレーム列から指定時刻の補間済みトーンカーブを返す。
 * キーフレームが 0〜1 個の場合は null（補間不要）。
 * 2個以上の場合は LUT ベースで補間した結果を返す。
 */
export function getToneCurvesAtTime(
  keyframes: ToneCurveKeyframe[],
  time: number,
): InterpolatedToneCurves | null {
  if (keyframes.length < 2) return null;

  // 範囲外: 最初のキーフレーム以前
  if (time <= keyframes[0].time) {
    const tc = keyframes[0].toneCurves;
    return { ...tc, ...buildCachedChannelLUTs(tc) };
  }

  // 範囲外: 最後のキーフレーム以降
  if (time >= keyframes[keyframes.length - 1].time) {
    const tc = keyframes[keyframes.length - 1].toneCurves;
    return { ...tc, ...buildCachedChannelLUTs(tc) };
  }

  // 区間を特定
  let prev = keyframes[0];
  let next = keyframes[1];
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (keyframes[i].time <= time && keyframes[i + 1].time > time) {
      prev = keyframes[i];
      next = keyframes[i + 1];
      break;
    }
  }

  const range = next.time - prev.time;
  if (range === 0) {
    const tc = prev.toneCurves;
    return { ...tc, ...buildCachedChannelLUTs(tc) };
  }

  const rawT = (time - prev.time) / range;
  const t = applyEasing(rawT, prev.easing);

  // キャッシュ済み LUT を取得して補間
  const prevLUTs = buildCachedChannelLUTs(prev.toneCurves);
  const nextLUTs = buildCachedChannelLUTs(next.toneCurves);

  const rgbLUT = interpolateToneCurveLUTs(prevLUTs.rgbLUT, nextLUTs.rgbLUT, t);
  const rLUT = interpolateToneCurveLUTs(prevLUTs.rLUT, nextLUTs.rLUT, t);
  const gLUT = interpolateToneCurveLUTs(prevLUTs.gLUT, nextLUTs.gLUT, t);
  const bLUT = interpolateToneCurveLUTs(prevLUTs.bLUT, nextLUTs.bLUT, t);

  // 補間結果の制御点は prev のものを保持（UI 表示用）
  return {
    rgb: prev.toneCurves.rgb,
    r: prev.toneCurves.r,
    g: prev.toneCurves.g,
    b: prev.toneCurves.b,
    rgbLUT,
    rLUT,
    gLUT,
    bLUT,
  };
}

/**
 * トーンカーブキーフレームがアクティブ（2個以上）かを判定する。
 */
export function hasActiveToneCurveKeyframes(
  keyframes: ToneCurveKeyframe[] | undefined,
): boolean {
  return !!keyframes && keyframes.length >= 2;
}
