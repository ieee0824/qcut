import { describe, it, expect } from 'vitest';
import {
  calculateDragNewStartTime,
  calculateClipPosition,
  calculateContextMenuTime,
  clampMenuPosition,
  collectSnapTargets,
  applySnap,
} from '../components/Timeline/clipUtils';

describe('calculateDragNewStartTime', () => {
  it('正の方向へのドラッグで開始時間が増加する', () => {
    // 100px 右にドラッグ, 50px/sec => +2秒
    const result = calculateDragNewStartTime(3, 100, 50);
    expect(result).toBe(5);
  });

  it('負の方向へのドラッグで開始時間が減少する', () => {
    const result = calculateDragNewStartTime(5, -100, 50);
    expect(result).toBe(3);
  });

  it('開始時間が0未満にならない', () => {
    // 3秒地点から -200px (= -4秒) ドラッグ → 0にクランプ
    const result = calculateDragNewStartTime(3, -200, 50);
    expect(result).toBe(0);
  });

  it('ちょうど0になるケース', () => {
    const result = calculateDragNewStartTime(2, -100, 50);
    expect(result).toBe(0);
  });

  it('pixelsPerSecondが大きいと同じピクセル移動で時間変化が小さい', () => {
    // 100px, 200px/sec => +0.5秒
    const result = calculateDragNewStartTime(1, 100, 200);
    expect(result).toBe(1.5);
  });

  it('deltaX が 0 のとき開始時間は変わらない', () => {
    const result = calculateDragNewStartTime(5, 0, 50);
    expect(result).toBe(5);
  });
});

describe('calculateClipPosition', () => {
  it('startTimeとdurationからleftとwidthを計算する', () => {
    const result = calculateClipPosition(2, 5, 50);
    expect(result).toEqual({ left: 100, width: 250 });
  });

  it('startTime が 0 のとき left は 0', () => {
    const result = calculateClipPosition(0, 3, 100);
    expect(result).toEqual({ left: 0, width: 300 });
  });

  it('pixelsPerSecond が変わるとスケールが変わる', () => {
    const result = calculateClipPosition(1, 1, 200);
    expect(result).toEqual({ left: 200, width: 200 });
  });
});

describe('calculateContextMenuTime', () => {
  it('クリップ中間をクリックしたときの時間を計算する', () => {
    // startTime=5, duration=10, relX=250px, pps=50 → relTime=5 → 5+5=10
    const result = calculateContextMenuTime(5, 10, 250, 50);
    expect(result).toBe(10);
  });

  it('クリップ先頭をクリックしたとき startTime を返す', () => {
    const result = calculateContextMenuTime(5, 10, 0, 50);
    expect(result).toBe(5);
  });

  it('負のrelativeXは0にクランプされる', () => {
    // relX=-50 → relTime=-1 → max(0, -1) = 0 → startTime + 0 = 5
    const result = calculateContextMenuTime(5, 10, -50, 50);
    expect(result).toBe(5);
  });

  it('durationを超えるrelativeXはdurationにクランプされる', () => {
    // relX=600 → relTime=12 → min(12, 10) = 10 → 5+10=15
    const result = calculateContextMenuTime(5, 10, 600, 50);
    expect(result).toBe(15);
  });
});

describe('clampMenuPosition', () => {
  const vw = 1920;
  const vh = 1080;

  it('ビューポート内に収まっている場合はそのまま返す', () => {
    const result = clampMenuPosition({ x: 100, y: 200 }, 200, 300, vw, vh);
    expect(result).toEqual({ x: 100, y: 200 });
  });

  it('右端にはみ出る場合はxを補正する', () => {
    const result = clampMenuPosition({ x: 1800, y: 100 }, 200, 300, vw, vh);
    expect(result).toEqual({ x: 1720, y: 100 });
  });

  it('下端にはみ出る場合はyを補正する', () => {
    const result = clampMenuPosition({ x: 100, y: 900 }, 200, 300, vw, vh);
    expect(result).toEqual({ x: 100, y: 780 });
  });

  it('右下にはみ出る場合は両方補正する', () => {
    const result = clampMenuPosition({ x: 1800, y: 900 }, 200, 300, vw, vh);
    expect(result).toEqual({ x: 1720, y: 780 });
  });

  it('負の座標は0にクランプされる', () => {
    const result = clampMenuPosition({ x: -50, y: -100 }, 200, 300, vw, vh);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  it('メニューがビューポートより大きい場合は左上に寄せる', () => {
    // menu 2000x1200, viewport 1920x1080 → x = 1920-2000 = -80 → 0, y = 1080-1200 = -120 → 0
    const result = clampMenuPosition({ x: 500, y: 500 }, 2000, 1200, vw, vh);
    expect(result).toEqual({ x: 0, y: 0 });
  });
});

// --- collectSnapTargets ---

describe('collectSnapTargets', () => {
  it('他のクリップの開始・終了位置を収集する', () => {
    const clips = [
      { startTime: 2, duration: 3 },  // end=5
      { startTime: 8, duration: 2 },  // end=10
    ];
    const targets = collectSnapTargets(clips, 'clip-self', 5.0);
    // 2, 5, 8, 10 + playhead=5.0
    expect(targets).toContain(2);
    expect(targets).toContain(5);
    expect(targets).toContain(8);
    expect(targets).toContain(10);
    expect(targets).toContain(5.0);
  });

  it('自分自身のクリップを除外する', () => {
    const clips = [
      { startTime: 2, duration: 3, id: 'clip-1' },
      { startTime: 8, duration: 2, id: 'clip-2' },
    ];
    const targets = collectSnapTargets(clips, 'clip-1', 0);
    expect(targets).not.toContain(2);
    expect(targets).not.toContain(5);
    expect(targets).toContain(8);
    expect(targets).toContain(10);
  });

  it('プレイヘッド位置を含む', () => {
    const targets = collectSnapTargets([], 'clip-1', 7.5);
    expect(targets).toContain(7.5);
  });

  it('重複するターゲットを除外する', () => {
    const clips = [
      { startTime: 5, duration: 3 },  // end=8
      { startTime: 8, duration: 2 },  // start=8（重複）
    ];
    const targets = collectSnapTargets(clips, 'clip-self', 8);
    const count8 = targets.filter(t => t === 8).length;
    expect(count8).toBe(1);
  });
});

// --- applySnap ---

describe('applySnap', () => {
  const threshold = 0.2; // 10px / 50pps

  it('クリップ先頭がターゲットに近い場合スナップする', () => {
    const targets = [5.0];
    const result = applySnap(4.9, 3, targets, threshold);
    expect(result.snapped).toBe(true);
    expect(result.startTime).toBe(5.0);
    expect(result.snapLine).toBe(5.0);
  });

  it('クリップ末尾がターゲットに近い場合スナップする', () => {
    const targets = [10.0];
    // startTime=6.9, duration=3 → end=9.9 → snap to 10 → startTime=7.0
    const result = applySnap(6.9, 3, targets, threshold);
    expect(result.snapped).toBe(true);
    expect(result.startTime).toBe(7.0);
    expect(result.snapLine).toBe(10.0);
  });

  it('閾値外の場合スナップしない', () => {
    const targets = [5.0];
    const result = applySnap(4.5, 3, targets, threshold);
    expect(result.snapped).toBe(false);
    expect(result.startTime).toBe(4.5);
    expect(result.snapLine).toBeNull();
  });

  it('先頭と末尾の両方が閾値内の場合、より近い方にスナップする', () => {
    const targets = [5.0, 8.05];
    // startTime=5.1, duration=3 → end=8.1
    // 先頭: |5.1 - 5.0| = 0.1
    // 末尾: |8.1 - 8.05| = 0.05 → こちらが近い
    const result = applySnap(5.1, 3, targets, threshold);
    expect(result.snapped).toBe(true);
    expect(result.startTime).toBeCloseTo(5.05);
    expect(result.snapLine).toBe(8.05);
  });

  it('ターゲットが空の場合スナップしない', () => {
    const result = applySnap(5, 3, [], threshold);
    expect(result.snapped).toBe(false);
    expect(result.startTime).toBe(5);
  });

  it('スナップ後の startTime が負にならない', () => {
    const targets = [0];
    // startTime=0.1, duration=3 → 先頭スナップで startTime=0
    const result = applySnap(0.1, 3, targets, threshold);
    expect(result.snapped).toBe(true);
    expect(result.startTime).toBe(0);
  });

  it('末尾スナップで target-duration < 0 となる場合はスナップしない', () => {
    // startTime=0, duration=0.6 → end=0.6
    // target=0.5 → target - duration = -0.1 < 0
    // 末尾距離 |0.6 - 0.5| = 0.1 < threshold=0.2 だがスナップしない
    const result = applySnap(0, 0.6, [0.5], threshold);
    expect(result.snapped).toBe(false);
    expect(result.startTime).toBe(0);
    expect(result.snapLine).toBeNull();
  });

  it('複数ターゲットの中で最も近いものにスナップする', () => {
    const targets = [3.0, 5.0, 8.0];
    // startTime=4.85, 先頭が5.0に近い(差0.15)
    const result = applySnap(4.85, 2, targets, threshold);
    expect(result.snapped).toBe(true);
    expect(result.startTime).toBe(5.0);
    expect(result.snapLine).toBe(5.0);
  });
});
