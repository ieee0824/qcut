use std::io::Write;

/// HSL色域別彩度パラメータ（WebGLシェーダーと同じ）
pub struct HslParams {
    pub red_sat: f64,
    pub yellow_sat: f64,
    pub green_sat: f64,
    pub cyan_sat: f64,
    pub blue_sat: f64,
    pub magenta_sat: f64,
}

impl HslParams {
    /// いずれかの値が有効（非ゼロ）かどうか
    pub fn is_active(&self) -> bool {
        const EPS: f64 = 0.01;
        self.red_sat.abs() > EPS
            || self.yellow_sat.abs() > EPS
            || self.green_sat.abs() > EPS
            || self.cyan_sat.abs() > EPS
            || self.blue_sat.abs() > EPS
            || self.magenta_sat.abs() > EPS
    }
}

const LUT_SIZE: usize = 33;

/// WebGLシェーダーと同じロジックで .cube LUT3D ファイルを生成する
pub fn generate_hsl_lut(params: &HslParams, path: &std::path::Path) -> Result<(), String> {
    let mut file =
        std::fs::File::create(path).map_err(|e| format!("LUTファイルの作成に失敗: {}", e))?;

    writeln!(file, "# HSL per-color saturation LUT (matches WebGL shader)")
        .map_err(|e| format!("LUT書き込みエラー: {}", e))?;
    writeln!(file, "LUT_3D_SIZE {}", LUT_SIZE)
        .map_err(|e| format!("LUT書き込みエラー: {}", e))?;

    // .cube 形式: R が最も内側のループ、B が最も外側
    for bi in 0..LUT_SIZE {
        for gi in 0..LUT_SIZE {
            for ri in 0..LUT_SIZE {
                let r = ri as f64 / (LUT_SIZE - 1) as f64;
                let g = gi as f64 / (LUT_SIZE - 1) as f64;
                let b = bi as f64 / (LUT_SIZE - 1) as f64;

                let (out_r, out_g, out_b) = apply_hsl_adjustment(r, g, b, params);

                writeln!(file, "{:.6} {:.6} {:.6}", out_r, out_g, out_b)
                    .map_err(|e| format!("LUT書き込みエラー: {}", e))?;
            }
        }
    }

    Ok(())
}

/// WebGLシェーダーの rgb2hsl と同じアルゴリズム
fn rgb2hsl(r: f64, g: f64, b: f64) -> (f64, f64, f64) {
    let max_c = r.max(g).max(b);
    let min_c = r.min(g).min(b);
    let l = (max_c + min_c) * 0.5;

    if (max_c - min_c).abs() < 1e-10 {
        return (0.0, 0.0, l);
    }

    let d = max_c - min_c;
    let s = if l > 0.5 {
        d / (2.0 - max_c - min_c)
    } else {
        d / (max_c + min_c)
    };

    let h = if (max_c - r).abs() < 1e-10 {
        let mut h = (g - b) / d;
        if g < b {
            h += 6.0;
        }
        h
    } else if (max_c - g).abs() < 1e-10 {
        (b - r) / d + 2.0
    } else {
        (r - g) / d + 4.0
    };

    (h / 6.0, s, l)
}

/// WebGLシェーダーの hue2rgb と同じアルゴリズム
fn hue2rgb(p: f64, q: f64, mut t: f64) -> f64 {
    if t < 0.0 {
        t += 1.0;
    }
    if t > 1.0 {
        t -= 1.0;
    }
    if t < 1.0 / 6.0 {
        return p + (q - p) * 6.0 * t;
    }
    if t < 1.0 / 2.0 {
        return q;
    }
    if t < 2.0 / 3.0 {
        return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
    }
    p
}

/// WebGLシェーダーの hsl2rgb と同じアルゴリズム
fn hsl2rgb(h: f64, s: f64, l: f64) -> (f64, f64, f64) {
    if s.abs() < 1e-10 {
        return (l, l, l);
    }
    let q = if l < 0.5 {
        l * (1.0 + s)
    } else {
        l + s - l * s
    };
    let p = 2.0 * l - q;
    (
        hue2rgb(p, q, h + 1.0 / 3.0),
        hue2rgb(p, q, h),
        hue2rgb(p, q, h - 1.0 / 3.0),
    )
}

/// WebGLシェーダーの colorWeight と同じアルゴリズム（三角窓、60°幅）
fn color_weight(hue360: f64, center: f64) -> f64 {
    let mut dist = (hue360 - center).abs();
    if dist > 180.0 {
        dist = 360.0 - dist;
    }
    (1.0 - dist / 60.0).clamp(0.0, 1.0)
}

/// WebGLシェーダーと同じ HSL 色域別彩度調整を適用
fn apply_hsl_adjustment(r: f64, g: f64, b: f64, params: &HslParams) -> (f64, f64, f64) {
    let (h, s, l) = rgb2hsl(r.clamp(0.0, 1.0), g.clamp(0.0, 1.0), b.clamp(0.0, 1.0));

    let hue360 = h * 360.0;
    let mut sat_adj = 0.0;
    sat_adj += color_weight(hue360, 0.0) * params.red_sat;
    sat_adj += color_weight(hue360, 360.0) * params.red_sat; // Red wrap-around
    sat_adj += color_weight(hue360, 60.0) * params.yellow_sat;
    sat_adj += color_weight(hue360, 120.0) * params.green_sat;
    sat_adj += color_weight(hue360, 180.0) * params.cyan_sat;
    sat_adj += color_weight(hue360, 240.0) * params.blue_sat;
    sat_adj += color_weight(hue360, 300.0) * params.magenta_sat;

    let new_s = (s + sat_adj).clamp(0.0, 1.0);
    let (out_r, out_g, out_b) = hsl2rgb(h, new_s, l);

    (out_r.clamp(0.0, 1.0), out_g.clamp(0.0, 1.0), out_b.clamp(0.0, 1.0))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rgb_hsl_roundtrip() {
        let cases = vec![
            (1.0, 0.0, 0.0), // red
            (0.0, 1.0, 0.0), // green
            (0.0, 0.0, 1.0), // blue
            (0.5, 0.5, 0.5), // gray
            (1.0, 1.0, 0.0), // yellow
        ];
        for (r, g, b) in cases {
            let (h, s, l) = rgb2hsl(r, g, b);
            let (r2, g2, b2) = hsl2rgb(h, s, l);
            assert!((r - r2).abs() < 1e-6, "R mismatch: {} vs {}", r, r2);
            assert!((g - g2).abs() < 1e-6, "G mismatch: {} vs {}", g, g2);
            assert!((b - b2).abs() < 1e-6, "B mismatch: {} vs {}", b, b2);
        }
    }

    #[test]
    fn test_color_weight_at_center() {
        assert!((color_weight(0.0, 0.0) - 1.0).abs() < 1e-6);
        assert!((color_weight(60.0, 60.0) - 1.0).abs() < 1e-6);
        assert!((color_weight(240.0, 240.0) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_color_weight_at_boundary() {
        assert!((color_weight(60.0, 0.0)).abs() < 1e-6); // 60° away = 0
        assert!((color_weight(30.0, 0.0) - 0.5).abs() < 1e-6); // 30° away = 0.5
    }

    #[test]
    fn test_color_weight_wrap_around() {
        // 350° is 10° away from 0° (red)
        assert!((color_weight(350.0, 0.0) - (1.0 - 10.0 / 60.0)).abs() < 1e-6);
    }

    #[test]
    fn test_full_desaturation() {
        let params = HslParams {
            red_sat: -1.0,
            yellow_sat: -1.0,
            green_sat: -1.0,
            cyan_sat: -1.0,
            blue_sat: -1.0,
            magenta_sat: -1.0,
        };
        // Pure red (hue=0) should become gray
        let (r, g, b) = apply_hsl_adjustment(1.0, 0.0, 0.0, &params);
        // With sat=-1 applied to red at hue=0, weight is 1.0 (from center 0) + some from 360 wrap
        // satAdj = -1.0 * 1.0 + -1.0 * 1.0 = -2.0, but clamped at 0
        // So saturation = max(0, original_sat + satAdj) = 0 → grayscale
        assert!((r - g).abs() < 0.01, "Should be near grayscale: r={} g={} b={}", r, g, b);
        assert!((g - b).abs() < 0.01, "Should be near grayscale: r={} g={} b={}", r, g, b);
    }

    #[test]
    fn test_no_change_with_zero_params() {
        let params = HslParams {
            red_sat: 0.0,
            yellow_sat: 0.0,
            green_sat: 0.0,
            cyan_sat: 0.0,
            blue_sat: 0.0,
            magenta_sat: 0.0,
        };
        let (r, g, b) = apply_hsl_adjustment(0.8, 0.3, 0.1, &params);
        assert!((r - 0.8).abs() < 1e-6);
        assert!((g - 0.3).abs() < 1e-6);
        assert!((b - 0.1).abs() < 1e-6);
    }
}
