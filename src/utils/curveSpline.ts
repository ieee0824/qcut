import type { CurvePoint } from '../store/timelineStore';

/**
 * 自然三次スプライン補間でカーブの制御点からLUTを生成する。
 *
 * @param points ソート済みの制御点（x: 0〜1, y: 0〜1）。最低2点必要。
 * @param size   LUTの要素数（デフォルト256）
 * @returns 0〜1の値が入ったFloat32Array（length = size）
 */
export function buildCurveLUT(points: CurvePoint[], size: number = 256): Float32Array {
  const lut = new Float32Array(size);

  // 点が0〜1個の場合はリニア
  if (points.length < 2) {
    for (let i = 0; i < size; i++) {
      lut[i] = i / (size - 1);
    }
    return lut;
  }

  // x でソート（破壊を避けるためコピー）
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const n = sorted.length;

  // 2点のみの場合は線形補間
  if (n === 2) {
    const [p0, p1] = sorted;
    const dx = p1.x - p0.x;
    for (let i = 0; i < size; i++) {
      const t = i / (size - 1);
      if (dx < 1e-9) {
        lut[i] = clamp01(p0.y);
      } else {
        const frac = clamp01((t - p0.x) / dx);
        lut[i] = clamp01(p0.y + frac * (p1.y - p0.y));
      }
    }
    return lut;
  }

  // 自然三次スプライン補間
  const splineY = cubicSplineInterpolate(sorted);

  for (let i = 0; i < size; i++) {
    const t = i / (size - 1);
    lut[i] = clamp01(splineY(t));
  }

  return lut;
}

/**
 * 自然三次スプライン (natural cubic spline) の補間関数を返す。
 * 境界条件: S''(x_0) = S''(x_n) = 0
 */
function cubicSplineInterpolate(points: CurvePoint[]): (x: number) => number {
  const n = points.length - 1; // 区間数
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  // h[i] = x[i+1] - x[i]
  const h: number[] = [];
  for (let i = 0; i < n; i++) {
    h.push(xs[i + 1] - xs[i]);
  }

  // 三重対角行列を解いて二次導関数 (sigma) を求める
  // 自然スプライン: sigma[0] = sigma[n] = 0
  const alpha: number[] = new Array(n + 1).fill(0);
  for (let i = 1; i < n; i++) {
    alpha[i] =
      (3 / h[i]) * (ys[i + 1] - ys[i]) -
      (3 / h[i - 1]) * (ys[i] - ys[i - 1]);
  }

  const l: number[] = new Array(n + 1).fill(1);
  const mu: number[] = new Array(n + 1).fill(0);
  const z: number[] = new Array(n + 1).fill(0);

  for (let i = 1; i < n; i++) {
    l[i] = 2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
  }

  const c: number[] = new Array(n + 1).fill(0);
  const b: number[] = new Array(n).fill(0);
  const d: number[] = new Array(n).fill(0);

  for (let j = n - 1; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (ys[j + 1] - ys[j]) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }

  return (x: number): number => {
    // クランプ
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n]) return ys[n];

    // 二分探索で区間を特定
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (x < xs[mid + 1]) {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }

    const i = lo;
    const dx = x - xs[i];
    return ys[i] + b[i] * dx + c[i] * dx * dx + d[i] * dx * dx * dx;
  };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * デフォルトカーブ（線形: (0,0)→(1,1)）かどうかを判定する。
 */
export function isDefaultCurve(points: CurvePoint[]): boolean {
  if (points.length !== 2) return false;
  const [p0, p1] = points;
  return (
    Math.abs(p0.x) < 1e-6 &&
    Math.abs(p0.y) < 1e-6 &&
    Math.abs(p1.x - 1) < 1e-6 &&
    Math.abs(p1.y - 1) < 1e-6
  );
}
