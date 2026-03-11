/**
 * Clip コンポーネントおよび関連フック内で使われる純粋な計算ロジック
 */

// --- Snap types ---

export interface SnapResult {
  snapped: boolean;
  startTime: number;
  snapLine: number | null; // スナップしたガイドラインの時間位置
}

/**
 * ドラッグ移動量（ピクセル）からクリップの新しい開始時間を計算する。
 * 結果は 0 以上にクランプされる。
 */
export function calculateDragNewStartTime(
  dragStartTime: number,
  deltaX: number,
  pixelsPerSecond: number,
): number {
  const deltaTime = deltaX / pixelsPerSecond;
  return Math.max(0, dragStartTime + deltaTime);
}

/**
 * クリップの startTime と duration からピクセル座標の left / width を計算する。
 */
export function calculateClipPosition(
  startTime: number,
  duration: number,
  pixelsPerSecond: number,
): { left: number; width: number } {
  return {
    left: startTime * pixelsPerSecond,
    width: duration * pixelsPerSecond,
  };
}

/**
 * 右クリック位置からプレイヘッドに設定する絶対時間を計算する。
 * relativeX はクリップ要素左端からのクリック座標。
 */
export function calculateContextMenuTime(
  clipStartTime: number,
  clipDuration: number,
  relativeX: number,
  pixelsPerSecond: number,
): number {
  const relTime = relativeX / pixelsPerSecond;
  return clipStartTime + Math.max(0, Math.min(relTime, clipDuration));
}

// --- Snap functions ---

/**
 * スナップターゲット（他クリップの先頭/末尾 + プレイヘッド）を収集する。
 * clips には全トラックのクリップをフラット化して渡す。
 */
export function collectSnapTargets(
  clips: Array<{ startTime: number; duration: number; id?: string }>,
  selfClipId: string,
  playheadTime: number,
): number[] {
  const set = new Set<number>();
  set.add(playheadTime);
  for (const clip of clips) {
    if (clip.id === selfClipId) continue;
    set.add(clip.startTime);
    set.add(clip.startTime + clip.duration);
  }
  return Array.from(set);
}

/**
 * ドラッグ中のクリップの先頭・末尾をスナップターゲットと照合し、
 * 閾値内であれば吸着した新しい startTime を返す。
 */
export function applySnap(
  startTime: number,
  duration: number,
  targets: number[],
  threshold: number,
): SnapResult {
  const endTime = startTime + duration;

  let bestDist = Infinity;
  let bestStartTime = startTime;
  let bestSnapLine: number | null = null;

  for (const target of targets) {
    // クリップ先頭がターゲットに近い
    const headDist = Math.abs(startTime - target);
    if (headDist < bestDist && headDist <= threshold) {
      bestDist = headDist;
      bestStartTime = target;
      bestSnapLine = target;
    }

    // クリップ末尾がターゲットに近い
    const tailDist = Math.abs(endTime - target);
    if (tailDist < bestDist && tailDist <= threshold) {
      bestDist = tailDist;
      bestStartTime = target - duration;
      bestSnapLine = target;
    }
  }

  const snapped = bestSnapLine !== null;
  return {
    snapped,
    startTime: snapped ? Math.max(0, bestStartTime) : startTime,
    snapLine: bestSnapLine,
  };
}

/**
 * コンテキストメニューの表示位置をビューポート内に収まるよう補正する。
 */
export function clampMenuPosition(
  position: { x: number; y: number },
  menuWidth: number,
  menuHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  let { x, y } = position;
  if (x + menuWidth > viewportWidth) {
    x = viewportWidth - menuWidth;
  }
  if (y + menuHeight > viewportHeight) {
    y = viewportHeight - menuHeight;
  }
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  return { x, y };
}
