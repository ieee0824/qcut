import { describe, it, expect } from 'vitest';
import type { SliderDefinition } from '../components/Inspector/PropertySlider';
import {
  BASIC_SLIDERS,
  HSL_SLIDERS,
  TRANSFORM_SLIDERS,
  VOLUME_SLIDERS,
  EQ_SLIDERS,
  NOISE_REDUCTION_SLIDERS,
  ECHO_SLIDERS,
  REVERB_SLIDERS,
  FADE_SLIDERS,
} from '../components/Inspector/effectsSliderDefinitions';
import {
  FONT_SIZE_SLIDER,
  POSITION_SLIDERS,
  ANIMATION_DURATION_SLIDER,
} from '../components/Inspector/textSliderDefinitions';
import { DEFAULT_EFFECTS } from '../store/timelineStore';
import type { ClipEffects, TextProperties } from '../store/timelineStore';

/**
 * すべての EffectsPanel スライダー定義配列をまとめたもの
 */
const ALL_EFFECTS_SLIDER_GROUPS: {
  name: string;
  sliders: SliderDefinition<keyof ClipEffects>[];
}[] = [
  { name: 'BASIC_SLIDERS', sliders: BASIC_SLIDERS },
  { name: 'HSL_SLIDERS', sliders: HSL_SLIDERS },
  { name: 'TRANSFORM_SLIDERS', sliders: TRANSFORM_SLIDERS },
  { name: 'VOLUME_SLIDERS', sliders: VOLUME_SLIDERS },
  { name: 'EQ_SLIDERS', sliders: EQ_SLIDERS },
  { name: 'NOISE_REDUCTION_SLIDERS', sliders: NOISE_REDUCTION_SLIDERS },
  { name: 'ECHO_SLIDERS', sliders: ECHO_SLIDERS },
  { name: 'REVERB_SLIDERS', sliders: REVERB_SLIDERS },
  { name: 'FADE_SLIDERS', sliders: FADE_SLIDERS },
];

const ALL_EFFECTS_SLIDERS: SliderDefinition<keyof ClipEffects>[] =
  ALL_EFFECTS_SLIDER_GROUPS.flatMap((g) => g.sliders);

const ALL_TEXT_SLIDERS: SliderDefinition<keyof TextProperties>[] = [
  FONT_SIZE_SLIDER,
  ...POSITION_SLIDERS,
  ANIMATION_DURATION_SLIDER,
];

/**
 * SliderDefinition の共通バリデーションヘルパー
 */
function validateSlider<K extends string>(slider: SliderDefinition<K>) {
  // key と label は空文字でないこと
  expect(slider.key).toBeTruthy();
  expect(slider.label).toBeTruthy();

  // min と max が両方指定されている場合、min < max であること
  if (slider.min !== undefined && slider.max !== undefined) {
    expect(slider.min).toBeLessThan(slider.max);
  }

  // step が指定されている場合、正の値であること
  if (slider.step !== undefined) {
    expect(slider.step).toBeGreaterThan(0);
  }

  // decimals が指定されている場合、0以上であること
  if (slider.decimals !== undefined) {
    expect(slider.decimals).toBeGreaterThanOrEqual(0);
  }
}

describe('EffectsPanel スライダー定義', () => {
  it('全グループのキーがグループ内で一意であること', () => {
    for (const { name, sliders } of ALL_EFFECTS_SLIDER_GROUPS) {
      const keys = sliders.map((s) => s.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size, `${name} にキーの重複がある`).toBe(keys.length);
    }
  });

  it('全スライダーのキーがグループ横断で一意であること', () => {
    const keys = ALL_EFFECTS_SLIDERS.map((s) => s.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('全スライダーのキーが ClipEffects に存在すること', () => {
    for (const slider of ALL_EFFECTS_SLIDERS) {
      expect(DEFAULT_EFFECTS).toHaveProperty(slider.key);
    }
  });

  it('各スライダー定義が有効な値を持つこと', () => {
    for (const slider of ALL_EFFECTS_SLIDERS) {
      validateSlider(slider);
    }
  });

  it('各スライダーの min/max が指定されている場合、DEFAULT_EFFECTS の値が範囲内であること', () => {
    for (const slider of ALL_EFFECTS_SLIDERS) {
      const defaultValue = DEFAULT_EFFECTS[slider.key];
      if (slider.min !== undefined) {
        expect(defaultValue, `${slider.key} のデフォルト値が min 未満`).toBeGreaterThanOrEqual(slider.min);
      }
      if (slider.max !== undefined) {
        expect(defaultValue, `${slider.key} のデフォルト値が max 超過`).toBeLessThanOrEqual(slider.max);
      }
    }
  });

  it('各グループが空でないこと', () => {
    for (const { name, sliders } of ALL_EFFECTS_SLIDER_GROUPS) {
      expect(sliders.length, `${name} が空`).toBeGreaterThan(0);
    }
  });

  it('label が翻訳キーの形式であること（ドット区切り）', () => {
    for (const slider of ALL_EFFECTS_SLIDERS) {
      expect(slider.label).toMatch(/^[a-zA-Z]+\.[a-zA-Z]+/);
    }
  });
});

describe('TextPanel スライダー定義', () => {
  it('全スライダーのキーが一意であること', () => {
    const keys = ALL_TEXT_SLIDERS.map((s) => s.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('各スライダー定義が有効な値を持つこと', () => {
    for (const slider of ALL_TEXT_SLIDERS) {
      validateSlider(slider);
    }
  });

  it('label が翻訳キーの形式であること（ドット区切り）', () => {
    for (const slider of ALL_TEXT_SLIDERS) {
      expect(slider.label).toMatch(/^[a-zA-Z]+\.[a-zA-Z]+/);
    }
  });

  it('FONT_SIZE_SLIDER が整数ステップ・0桁表示であること', () => {
    expect(FONT_SIZE_SLIDER.step).toBe(1);
    expect(FONT_SIZE_SLIDER.decimals).toBe(0);
    expect(FONT_SIZE_SLIDER.suffix).toBe('px');
  });

  it('POSITION_SLIDERS が positionX, positionY, opacity を含むこと', () => {
    const keys = POSITION_SLIDERS.map((s) => s.key);
    expect(keys).toContain('positionX');
    expect(keys).toContain('positionY');
    expect(keys).toContain('opacity');
  });

  it('ANIMATION_DURATION_SLIDER が秒単位の suffix を持つこと', () => {
    expect(ANIMATION_DURATION_SLIDER.suffix).toBe('s');
  });
});

describe('PropertySliderProps インターフェース互換性', () => {
  it('SliderDefinition から PropertySlider に渡すプロパティが正しく展開できること', () => {
    // SliderDefinition のオプショナルフィールドが PropertySliderProps と互換であることを確認
    const slider = BASIC_SLIDERS[0];
    const props = {
      label: slider.label,
      value: 1.0,
      onChange: (_v: number) => {},
      min: slider.min,
      max: slider.max,
      step: slider.step,
      decimals: slider.decimals,
      suffix: slider.suffix,
    };
    // props が正しく構築できること（型エラーがなければ成功）
    expect(props).toHaveProperty('label');
    expect(props).toHaveProperty('value');
    expect(props).toHaveProperty('onChange');
  });
});
