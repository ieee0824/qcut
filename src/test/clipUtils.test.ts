import { describe, it, expect } from 'vitest';
import {
  calculateDragNewStartTime,
  calculateClipPosition,
  calculateContextMenuTime,
  clampMenuPosition,
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
