import type { ClipEffects, Clip, EasingType, Keyframe } from '../store/timeline/types';
import { DEFAULT_EFFECTS } from '../store/timelineStore';

function applyEasing(t: number, easing: EasingType): number {
  switch (easing) {
    case 'easeIn':    return t * t;
    case 'easeOut':   return t * (2 - t);
    case 'easeInOut': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    default:          return t; // linear
  }
}

/**
 * キーフレーム列から指定時刻の値を補間して返す。
 * キーフレームが 0 個の場合は null を返す。
 * キーフレームが 1 個の場合はその値を返す（補間なし）。
 * ※ ストアは挿入時にソート済みを保証するため、引数は time 昇順であること。
 */
export function interpolateKeyframes(keyframes: Keyframe[], time: number): number | null {
  if (keyframes.length === 0) return null;
  if (keyframes.length === 1) return keyframes[0].value;

  // ストアは挿入時にソート済みのため、ここでのソートは不要
  if (time <= keyframes[0].time) return keyframes[0].value;
  if (time >= keyframes[keyframes.length - 1].time) return keyframes[keyframes.length - 1].value;

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
  if (range === 0) return prev.value;

  const t = (time - prev.time) / range;
  const easedT = applyEasing(t, prev.easing);
  return prev.value + (next.value - prev.value) * easedT;
}

/**
 * クリップ内の指定時刻（クリップ先頭からの秒数）におけるエフェクト値を返す。
 * キーフレームが 2 個以上あるパラメータは補間値、それ以外は clip.effects の値を使用する。
 */
export function getEffectsAtTime(clip: Clip, clipLocalTime: number): ClipEffects {
  const base: ClipEffects = { ...DEFAULT_EFFECTS, ...clip.effects };
  if (!clip.keyframes) return base;

  const result = { ...base };
  for (const [key, kframes] of Object.entries(clip.keyframes)) {
    if (!kframes || kframes.length < 2) continue;
    const interpolated = interpolateKeyframes(kframes, clipLocalTime);
    if (interpolated !== null) {
      (result as Record<string, number>)[key] = interpolated;
    }
  }
  return result;
}

/**
 * クリップにアクティブなキーフレーム（2 個以上）があるか判定する。
 */
export function hasActiveKeyframes(clip: Clip): boolean {
  if (!clip.keyframes) return false;
  return Object.values(clip.keyframes).some((kfs) => kfs && kfs.length >= 2);
}
