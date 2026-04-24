import type { Clip, Keyframe, EasingType } from '../store/timeline/types';

const TIME_TOLERANCE = 0.001;

/**
 * クリップをタイムライン上の指定時刻で2つに分割する。
 * 分割不可（時刻がクリップ範囲外）なら null を返す。
 */
export function splitClip(clip: Clip, splitTime: number): [Clip, Clip] | null {
  const relativeTime = splitTime - clip.startTime;
  if (relativeTime <= 0 || relativeTime >= clip.duration) return null;

  const first: Clip = {
    ...clip,
    id: `${clip.id}-1`,
    duration: relativeTime,
    sourceEndTime: clip.sourceStartTime + relativeTime,
  };

  const second: Clip = {
    ...clip,
    id: `${clip.id}-2`,
    startTime: clip.startTime + relativeTime,
    duration: clip.duration - relativeTime,
    sourceStartTime: clip.sourceStartTime + relativeTime,
  };

  return [first, second];
}

/**
 * キーフレーム配列に新しいキーフレームを追加（同一時刻なら上書き）し、時刻順でソートして返す。
 */
export function upsertKeyframe(existing: readonly Keyframe[], keyframe: Keyframe): Keyframe[] {
  const filtered = existing.filter(kf => Math.abs(kf.time - keyframe.time) > TIME_TOLERANCE);
  return [...filtered, keyframe].sort((a, b) => a.time - b.time);
}

/**
 * 指定時刻のキーフレームを除去して返す。
 */
export function removeKeyframeAtTime(existing: readonly Keyframe[], time: number): Keyframe[] {
  return existing.filter(kf => Math.abs(kf.time - time) > TIME_TOLERANCE);
}

/**
 * 指定時刻のキーフレームの easing を更新して返す。
 */
export function updateKeyframeEasingAtTime(
  existing: readonly Keyframe[],
  time: number,
  easing: EasingType,
): Keyframe[] {
  return existing.map(kf =>
    Math.abs(kf.time - time) <= TIME_TOLERANCE ? { ...kf, easing } : kf,
  );
}

/**
 * 指定時刻のキーフレームを別の時刻に移動し、重複があれば後勝ちで上書きして返す。
 */
export function moveKeyframeTime(
  existing: readonly Keyframe[],
  fromTime: number,
  toTime: number,
): Keyframe[] {
  const moved = existing.map(kf =>
    Math.abs(kf.time - fromTime) <= TIME_TOLERANCE ? { ...kf, time: toTime } : kf,
  );
  const sorted = [...moved].sort((a, b) => a.time - b.time);

  // 同一時刻の重複を後勝ちで解消
  const deduped: Keyframe[] = [];
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
