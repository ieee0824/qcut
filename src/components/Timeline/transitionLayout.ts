import type { Clip, TimelineTransition } from '../../store/timelineStore';

/**
 * トランジションインジケーターの位置とサイズを計算する純粋関数。
 */
export function computeIndicatorLayout(
  transition: Pick<TimelineTransition, 'duration'>,
  pixelsPerSecond: number,
  incomingClip: Pick<Clip, 'startTime'>,
): { width: number; left: number } {
  const width = transition.duration * pixelsPerSecond;
  const left = incomingClip.startTime * pixelsPerSecond - width / 2;
  return { width, left };
}
