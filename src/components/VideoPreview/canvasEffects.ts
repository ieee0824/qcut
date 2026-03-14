/* eslint-disable no-undef */
import type { ClipEffects, ToneCurves } from '../../store/timelineStore';
import { buildCurveLUT, isDefaultCurve } from '../../utils/curveSpline';

/**
 * HSL色域別彩度や色温度など、CSS filterでは表現できないエフェクトが
 * 有効かどうかを判定する。trueの場合、WebGLパイプラインを使用する。
 */
export function needsCanvasPipeline(effects: ClipEffects, toneCurves?: ToneCurves): boolean {
  const EPS = 0.001;
  return (
    Math.abs(effects.hslRedSat) > EPS ||
    Math.abs(effects.hslYellowSat) > EPS ||
    Math.abs(effects.hslGreenSat) > EPS ||
    Math.abs(effects.hslCyanSat) > EPS ||
    Math.abs(effects.hslBlueSat) > EPS ||
    Math.abs(effects.hslMagentaSat) > EPS ||
    Math.abs(effects.liftR) > EPS ||
    Math.abs(effects.liftG) > EPS ||
    Math.abs(effects.liftB) > EPS ||
    Math.abs(effects.gammaR) > EPS ||
    Math.abs(effects.gammaG) > EPS ||
    Math.abs(effects.gammaB) > EPS ||
    Math.abs(effects.gainR) > EPS ||
    Math.abs(effects.gainG) > EPS ||
    Math.abs(effects.gainB) > EPS ||
    effects.blurAmount > EPS ||
    effects.sharpenAmount > EPS ||
    effects.monochrome > EPS ||
    hasCurveActive(toneCurves)
  );
}

function hasCurveActive(toneCurves?: ToneCurves): boolean {
  if (!toneCurves) return false;
  return (
    !isDefaultCurve(toneCurves.rgb) ||
    !isDefaultCurve(toneCurves.r) ||
    !isDefaultCurve(toneCurves.g) ||
    !isDefaultCurve(toneCurves.b)
  );
}

// --- WebGL Shader Sources ---

const VERTEX_SHADER_SRC = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

const FRAGMENT_SHADER_SRC = `
precision mediump float;
varying vec2 v_texCoord;
uniform sampler2D u_texture;

// Basic effects
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_hue;           // degrees
uniform float u_colorTemp;     // -1 to 1

// HSL per-color saturation
uniform float u_hslRedSat;
uniform float u_hslYellowSat;
uniform float u_hslGreenSat;
uniform float u_hslCyanSat;
uniform float u_hslBlueSat;
uniform float u_hslMagentaSat;

// Lift/Gamma/Gain (3-way color correction)
uniform vec3 u_lift;   // shadow color shift
uniform vec3 u_gamma;  // midtone color shift
uniform vec3 u_gain;   // highlight color shift

// Filters
uniform vec2 u_texSize;        // texture size in pixels
uniform float u_blurAmount;    // 0 = off, radius in pixels
uniform float u_sharpenAmount; // 0 = off, strength
uniform float u_monochrome;    // 0 = off, 1 = full monochrome

// Tone Curves LUT (256x1 RGBA: R=Rcurve, G=Gcurve, B=Bcurve, A=RGBcurve)
uniform sampler2D u_curveLUT;
uniform float u_curveEnabled;  // 0 = off, 1 = on

vec3 rgb2hsl(vec3 c) {
  float maxC = max(c.r, max(c.g, c.b));
  float minC = min(c.r, min(c.g, c.b));
  float l = (maxC + minC) * 0.5;
  if (maxC == minC) return vec3(0.0, 0.0, l);
  float d = maxC - minC;
  float s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
  float h;
  if (maxC == c.r) {
    h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
  } else if (maxC == c.g) {
    h = (c.b - c.r) / d + 2.0;
  } else {
    h = (c.r - c.g) / d + 4.0;
  }
  h /= 6.0;
  return vec3(h, s, l);
}

float hue2rgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
  if (t < 1.0/2.0) return q;
  if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
  return p;
}

vec3 hsl2rgb(vec3 hsl) {
  float h = hsl.x, s = hsl.y, l = hsl.z;
  if (s == 0.0) return vec3(l);
  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
  float p = 2.0 * l - q;
  return vec3(
    hue2rgb(p, q, h + 1.0/3.0),
    hue2rgb(p, q, h),
    hue2rgb(p, q, h - 1.0/3.0)
  );
}

// 色域別の重みを計算（smooth triangular falloff, 60度幅）
float colorWeight(float hue360, float center) {
  float dist = abs(hue360 - center);
  if (dist > 180.0) dist = 360.0 - dist;
  return clamp(1.0 - dist / 60.0, 0.0, 1.0);
}

void main() {
  vec4 texColor;

  // Blur (9-tap Gaussian approximation)
  if (u_blurAmount > 0.01) {
    vec2 step = u_blurAmount / u_texSize;
    vec4 c00 = texture2D(u_texture, v_texCoord + vec2(-step.x, -step.y));
    vec4 c01 = texture2D(u_texture, v_texCoord + vec2(    0.0, -step.y));
    vec4 c02 = texture2D(u_texture, v_texCoord + vec2( step.x, -step.y));
    vec4 c10 = texture2D(u_texture, v_texCoord + vec2(-step.x,     0.0));
    vec4 c11 = texture2D(u_texture, v_texCoord);
    vec4 c12 = texture2D(u_texture, v_texCoord + vec2( step.x,     0.0));
    vec4 c20 = texture2D(u_texture, v_texCoord + vec2(-step.x,  step.y));
    vec4 c21 = texture2D(u_texture, v_texCoord + vec2(    0.0,  step.y));
    vec4 c22 = texture2D(u_texture, v_texCoord + vec2( step.x,  step.y));
    texColor = (c00 + c02 + c20 + c22 + (c01 + c10 + c12 + c21) * 2.0 + c11 * 4.0) / 16.0;
  // Sharpen (unsharp mask, 5-tap cross)
  } else if (u_sharpenAmount > 0.01) {
    vec2 step = 1.0 / u_texSize;
    vec4 center = texture2D(u_texture, v_texCoord);
    vec4 n = texture2D(u_texture, v_texCoord + vec2(     0.0, -step.y));
    vec4 s = texture2D(u_texture, v_texCoord + vec2(     0.0,  step.y));
    vec4 w = texture2D(u_texture, v_texCoord + vec2(-step.x,      0.0));
    vec4 e = texture2D(u_texture, v_texCoord + vec2( step.x,      0.0));
    vec4 blur = (n + s + w + e) / 4.0;
    texColor = clamp(center + u_sharpenAmount * (center - blur), 0.0, 1.0);
  } else {
    texColor = texture2D(u_texture, v_texCoord);
  }

  vec3 rgb = texColor.rgb;

  // Brightness
  rgb *= u_brightness;

  // Contrast
  rgb = (rgb - 0.5) * u_contrast + 0.5;

  // Convert to HSL
  vec3 hsl = rgb2hsl(clamp(rgb, 0.0, 1.0));

  // Global hue shift
  if (abs(u_hue) > 0.01) {
    hsl.x += u_hue / 360.0;
    if (hsl.x < 0.0) hsl.x += 1.0;
    if (hsl.x > 1.0) hsl.x -= 1.0;
  }

  // Global saturation
  hsl.y *= u_saturation;

  // Per-color saturation adjustment
  float hue360 = hsl.x * 360.0;
  float satAdj = 0.0;
  satAdj += colorWeight(hue360, 0.0) * u_hslRedSat;
  satAdj += colorWeight(hue360, 360.0) * u_hslRedSat; // wrap-around for red
  satAdj += colorWeight(hue360, 60.0) * u_hslYellowSat;
  satAdj += colorWeight(hue360, 120.0) * u_hslGreenSat;
  satAdj += colorWeight(hue360, 180.0) * u_hslCyanSat;
  satAdj += colorWeight(hue360, 240.0) * u_hslBlueSat;
  satAdj += colorWeight(hue360, 300.0) * u_hslMagentaSat;
  hsl.y = clamp(hsl.y + satAdj, 0.0, 1.0);

  // Color temperature (warm/cool shift)
  vec3 result = hsl2rgb(vec3(hsl.x, clamp(hsl.y, 0.0, 1.0), hsl.z));
  if (abs(u_colorTemp) > 0.01) {
    // Warm: increase red, decrease blue. Cool: increase blue, decrease red.
    float warmShift = u_colorTemp * 0.15;
    result.r += warmShift;
    result.b -= warmShift;
    result.r = clamp(result.r, 0.0, 1.0);
    result.b = clamp(result.b, 0.0, 1.0);
  }

  // 3-way color correction: Lift/Gamma/Gain
  // Lift: shifts shadows (black point) — result + lift * (1 - result)
  // Gain: scales highlights — result * (1 + gain)
  // Gamma: midtone curve — pow(result, 1 / (1 + gamma))
  result = result + u_lift * (vec3(1.0) - result);
  result = result * (vec3(1.0) + u_gain);
  vec3 gammaExp = vec3(1.0) / max(vec3(1.0) + u_gamma, vec3(0.01));
  result = pow(clamp(result, vec3(0.0), vec3(1.0)), gammaExp);

  // Monochrome (lerp saturation toward luma)
  if (u_monochrome >= 0.01) {
    float luma = dot(result, vec3(0.2126, 0.7152, 0.0722));
    result = mix(result, vec3(luma), u_monochrome);
  }

  // Tone Curves (applied last, after all color corrections)
  if (u_curveEnabled > 0.5) {
    result = clamp(result, 0.0, 1.0);
    // Per-channel curves (R, G, B stored in R, G, B channels of LUT)
    float lutR = texture2D(u_curveLUT, vec2(result.r, 0.5)).r;
    float lutG = texture2D(u_curveLUT, vec2(result.g, 0.5)).g;
    float lutB = texture2D(u_curveLUT, vec2(result.b, 0.5)).b;
    // RGB master curve (stored in A channel of LUT)
    result.r = texture2D(u_curveLUT, vec2(lutR, 0.5)).a;
    result.g = texture2D(u_curveLUT, vec2(lutG, 0.5)).a;
    result.b = texture2D(u_curveLUT, vec2(lutB, 0.5)).a;
  }

  gl_FragColor = vec4(clamp(result, 0.0, 1.0), texColor.a);
}
`;

// --- WebGL Pipeline Types ---

export interface WebGLPipeline {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  texture: WebGLTexture;
  curveLUTTexture: WebGLTexture;
  uniforms: Record<string, WebGLUniformLocation>;
  /** readPixels用の再利用バッファ（サイズ変更時のみ再確保） */
  readBuf: Uint8Array | null;
  readBufSize: number;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

export function initWebGLPipeline(canvas: HTMLCanvasElement): WebGLPipeline | null {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;

  const vertShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
  const fragShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);

  const program = gl.createProgram()!;
  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
  }

  gl.useProgram(program);

  // Fullscreen quad (2 triangles)
  const posBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1,  -1, 1,
    -1,  1,  1, -1,   1, 1,
  ]), gl.STATIC_DRAW);
  const posLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  // Texture coordinates (flip Y for video)
  const texBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0, 1,  1, 1,  0, 0,
    0, 0,  1, 1,  1, 0,
  ]), gl.STATIC_DRAW);
  const texLoc = gl.getAttribLocation(program, 'a_texCoord');
  gl.enableVertexAttribArray(texLoc);
  gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

  // Video texture
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // Curve LUT texture (256x1 RGBA)
  const curveLUTTexture = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, curveLUTTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  // Init with identity (linear) LUT
  const identityLUT = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    identityLUT[i * 4 + 0] = i; // R
    identityLUT[i * 4 + 1] = i; // G
    identityLUT[i * 4 + 2] = i; // B
    identityLUT[i * 4 + 3] = i; // A (RGB master)
  }
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, identityLUT);
  gl.activeTexture(gl.TEXTURE0);

  // Collect uniform locations
  const uniformNames = [
    'u_brightness', 'u_contrast', 'u_saturation', 'u_hue', 'u_colorTemp',
    'u_hslRedSat', 'u_hslYellowSat', 'u_hslGreenSat',
    'u_hslCyanSat', 'u_hslBlueSat', 'u_hslMagentaSat',
    'u_lift', 'u_gamma', 'u_gain',
    'u_texSize', 'u_blurAmount', 'u_sharpenAmount', 'u_monochrome',
    'u_curveLUT', 'u_curveEnabled',
  ];
  const uniforms: Record<string, WebGLUniformLocation> = {};
  for (const name of uniformNames) {
    const loc = gl.getUniformLocation(program, name);
    if (loc) uniforms[name] = loc;
  }

  // Set texture unit for curve LUT
  gl.uniform1i(uniforms['u_curveLUT'], 1);

  return { gl, program, texture, curveLUTTexture, uniforms, readBuf: null, readBufSize: 0 };
}

/** キーフレーム補間で事前計算された LUT（Float32Array, 各256要素） */
export interface PrecomputedLUTs {
  rgbLUT: Float32Array;
  rLUT: Float32Array;
  gLUT: Float32Array;
  bLUT: Float32Array;
}

export function renderFrame(
  pipeline: WebGLPipeline,
  video: HTMLVideoElement,
  effects: ClipEffects,
  toneCurves?: ToneCurves,
  precomputedLUTs?: PrecomputedLUTs,
): void {
  // Skip if video is not ready (HAVE_CURRENT_DATA = 2)
  if (video.readyState < 2) return;

  const { gl, texture, curveLUTTexture, uniforms } = pipeline;

  // Resize canvas to match video's intrinsic dimensions (aspect ratio preserved by CSS object-fit)
  const canvas = gl.canvas as HTMLCanvasElement;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw === 0 || vh === 0) return;
  if (canvas.width !== vw || canvas.height !== vh) {
    canvas.width = vw;
    canvas.height = vh;
    gl.viewport(0, 0, vw, vh);
  }

  // Upload video frame as texture
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

  // Upload curve LUT texture
  const curveActive = precomputedLUTs ? true : hasCurveActive(toneCurves);
  if (curveActive) {
    const lutData = precomputedLUTs
      ? buildLUTTextureFromFloat32(precomputedLUTs)
      : toneCurves ? buildCurveLUTTexture(toneCurves) : null;
    if (lutData) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, curveLUTTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, lutData);
      gl.activeTexture(gl.TEXTURE0);
    }
  }
  gl.uniform1f(uniforms['u_curveEnabled'], curveActive ? 1.0 : 0.0);

  // Set uniforms
  gl.uniform1f(uniforms['u_brightness'], effects.brightness);
  gl.uniform1f(uniforms['u_contrast'], effects.contrast);
  gl.uniform1f(uniforms['u_saturation'], effects.saturation);
  gl.uniform1f(uniforms['u_hue'], effects.hue);
  gl.uniform1f(uniforms['u_colorTemp'], effects.colorTemperature);
  gl.uniform1f(uniforms['u_hslRedSat'], effects.hslRedSat);
  gl.uniform1f(uniforms['u_hslYellowSat'], effects.hslYellowSat);
  gl.uniform1f(uniforms['u_hslGreenSat'], effects.hslGreenSat);
  gl.uniform1f(uniforms['u_hslCyanSat'], effects.hslCyanSat);
  gl.uniform1f(uniforms['u_hslBlueSat'], effects.hslBlueSat);
  gl.uniform1f(uniforms['u_hslMagentaSat'], effects.hslMagentaSat);
  gl.uniform3f(uniforms['u_lift'], effects.liftR, effects.liftG, effects.liftB);
  gl.uniform3f(uniforms['u_gamma'], effects.gammaR, effects.gammaG, effects.gammaB);
  gl.uniform3f(uniforms['u_gain'], effects.gainR, effects.gainG, effects.gainB);
  gl.uniform2f(uniforms['u_texSize'], vw, vh);
  gl.uniform1f(uniforms['u_blurAmount'], effects.blurAmount);
  gl.uniform1f(uniforms['u_sharpenAmount'], effects.sharpenAmount);
  gl.uniform1f(uniforms['u_monochrome'], effects.monochrome);

  // Draw
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

/**
 * ToneCurves から 256x1 RGBA テクスチャデータを生成する。
 * R=Rカーブ, G=Gカーブ, B=Bカーブ, A=RGBマスターカーブ
 * 同一参照のtoneCurvesに対してはキャッシュを返す。
 */
let _cachedToneCurves: ToneCurves | null = null;
let _cachedLUTData: Uint8Array | null = null;

function buildLUTTextureFromFloat32(luts: PrecomputedLUTs): Uint8Array {
  const data = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    data[i * 4 + 0] = Math.round(luts.rLUT[i] * 255);
    data[i * 4 + 1] = Math.round(luts.gLUT[i] * 255);
    data[i * 4 + 2] = Math.round(luts.bLUT[i] * 255);
    data[i * 4 + 3] = Math.round(luts.rgbLUT[i] * 255);
  }
  return data;
}

function buildCurveLUTTexture(toneCurves: ToneCurves): Uint8Array {
  if (_cachedToneCurves === toneCurves && _cachedLUTData) {
    return _cachedLUTData;
  }
  const rLUT = buildCurveLUT(toneCurves.r, 256);
  const gLUT = buildCurveLUT(toneCurves.g, 256);
  const bLUT = buildCurveLUT(toneCurves.b, 256);
  const rgbLUT = buildCurveLUT(toneCurves.rgb, 256);

  const data = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    data[i * 4 + 0] = Math.round(rLUT[i] * 255);
    data[i * 4 + 1] = Math.round(gLUT[i] * 255);
    data[i * 4 + 2] = Math.round(bLUT[i] * 255);
    data[i * 4 + 3] = Math.round(rgbLUT[i] * 255);
  }
  _cachedToneCurves = toneCurves;
  _cachedLUTData = data;
  return data;
}

/**
 * WebGLパイプラインからレンダリング済みフレームのピクセルデータを読み出す。
 * renderFrame() の直後に呼ぶこと。
 */
export function readPixels(pipeline: WebGLPipeline): Uint8Array | null {
  const { gl } = pipeline;
  const canvas = gl.canvas as HTMLCanvasElement;
  const w = canvas.width;
  const h = canvas.height;
  if (w === 0 || h === 0) return null;
  const needed = w * h * 4;
  if (!pipeline.readBuf || pipeline.readBufSize !== needed) {
    pipeline.readBuf = new Uint8Array(needed);
    pipeline.readBufSize = needed;
  }
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pipeline.readBuf);
  return pipeline.readBuf;
}

export function destroyPipeline(pipeline: WebGLPipeline): void {
  const { gl, program, texture, curveLUTTexture } = pipeline;
  gl.deleteTexture(texture);
  gl.deleteTexture(curveLUTTexture);
  gl.deleteProgram(program);
  const ext = gl.getExtension('WEBGL_lose_context');
  if (ext) ext.loseContext();
}
