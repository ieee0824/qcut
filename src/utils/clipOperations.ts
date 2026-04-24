import type { Clip, EasingType } from '../store/timeline/types';

export const TIME_TOLERANCE = 0.001;

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/**
 * クリップをタイムライン上の指定時刻で2つに分割する。
 * 分割不可（時刻がクリップ範囲外）なら null を返す。
 * 各クリップはディープコピーされ、ネストオブジェクトの参照を共有しない。
 */
export function splitClip(clip: Clip, splitTime: number): [Clip, Clip] | null {
  const relativeTime = splitTime - clip.startTime;
  if (relativeTime <= 0 || relativeTime >= clip.duration) return null;

  const first: Clip = {
    ...deepClone(clip),
    id: `${clip.id}-1`,
    duration: relativeTime,
    sourceEndTime: clip.sourceStartTime + relativeTime,
  };

  const second: Clip = {
    ...deepClone(clip),
    id: `${clip.id}-2`,
    startTime: clip.startTime + relativeTime,
    duration: clip.duration - relativeTime,
    sourceStartTime: clip.sourceStartTime + relativeTime,
  };

  return [first, second];
}

/**
 * 時刻付きオブジェクトの配列に新しい要素を追加（同一時刻なら上書き）し、時刻順でソートして返す。
 * Keyframe, ToneCurveKeyframe いずれにも使用可能。
 */
export function upsertKeyframe<T extends { time: number }>(existing: readonly T[], keyframe: T): T[] {
  const filtered = existing.filter(kf => Math.abs(kf.time - keyframe.time) > TIME_TOLERANCE);
  return [...filtered, keyframe].sort((a, b) => a.time - b.time);
}

/**
 * 指定時刻の要素を除去して返す。
 */
export function removeKeyframeAtTime<T extends { time: number }>(existing: readonly T[], time: number): T[] {
  return existing.filter(kf => Math.abs(kf.time - time) > TIME_TOLERANCE);
}

/**
 * 指定時刻の要素の easing を更新して返す。
 */
export function updateKeyframeEasingAtTime<T extends { time: number; easing: EasingType }>(
  existing: readonly T[],
  time: number,
  easing: EasingType,
): T[] {
  return existing.map(kf =>
    Math.abs(kf.time - time) <= TIME_TOLERANCE ? { ...kf, easing } as T : kf,
  );
}

/**
 * 指定時刻の要素を別の時刻に移動し、重複があれば移動した方が勝つ（上書き）。
 */
export function moveKeyframeTime<T extends { time: number }>(
  existing: readonly T[],
  fromTime: number,
  toTime: number,
): T[] {
  const isTarget = (kf: T) => Math.abs(kf.time - fromTime) <= TIME_TOLERANCE;
  const unmoved = existing.filter(kf => !isTarget(kf));
  const moved = existing.filter(isTarget).map(kf => ({ ...kf, time: toTime }) as T);
  // moved を後ろに配置: stable sort 後の dedup で移動した方が勝つ
  const sorted = [...unmoved, ...moved].sort((a, b) => a.time - b.time);

  const deduped: T[] = [];
  for (const kf of sorted) {
    const last = deduped[deduped.length - 1];
    if (last && Math.abs(last.time - kf.time) <= TIME_TOLERANCE) {
      deduped[deduped.length - 1] = kf;
    } else {
      deduped.push(kf);
    }
  }
  return deduped;
}
