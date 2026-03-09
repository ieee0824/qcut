import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioEngine } from '../audio/AudioEngine';
import { DEFAULT_EFFECTS, ClipEffects } from '../store/timelineStore';

/**
 * AudioEngine のテスト
 * Web Audio API のノードグラフ構築・エフェクト更新・クリーンアップを検証
 */

// Web Audio API のモック
function createMockAudioContext() {
  const mockGainNode = () => ({
    gain: { value: 1, setTargetAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  });

  const mockBiquadFilter = () => ({
    type: 'lowpass',
    frequency: { value: 350, setTargetAtTime: vi.fn() },
    Q: { value: 1, setTargetAtTime: vi.fn() },
    gain: { value: 0, setTargetAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  });

  const mockDelayNode = () => ({
    delayTime: { value: 0, setTargetAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  });

  const mockConvolverNode = () => ({
    buffer: null as AudioBuffer | null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  });

  const mockMediaElementSource = () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  });

  const mockBuffer = {
    duration: 1.0,
    sampleRate: 44100,
    length: 44100,
    numberOfChannels: 2,
    getChannelData: vi.fn().mockReturnValue(new Float32Array(44100)),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  };

  const ctx = {
    state: 'running' as string,
    currentTime: 0,
    sampleRate: 44100,
    resume: vi.fn(),
    close: vi.fn().mockImplementation(function (this: { state: string }) {
      this.state = 'closed';
    }),
    createMediaElementSource: vi.fn().mockReturnValue(mockMediaElementSource()),
    createGain: vi.fn().mockImplementation(mockGainNode),
    createBiquadFilter: vi.fn().mockImplementation(mockBiquadFilter),
    createDelay: vi.fn().mockImplementation(mockDelayNode),
    createConvolver: vi.fn().mockImplementation(mockConvolverNode),
    createBuffer: vi.fn().mockReturnValue(mockBuffer),
    destination: { connect: vi.fn() },
  };

  return ctx;
}

// 各テストで新しいモックを返すようにする
let mockCtx: ReturnType<typeof createMockAudioContext>;

vi.stubGlobal('AudioContext', vi.fn().mockImplementation(function () {
  mockCtx = createMockAudioContext();
  return mockCtx;
}));

describe('AudioEngine', () => {
  let engine: AudioEngine;

  beforeEach(() => {
    engine = new AudioEngine();
    vi.clearAllMocks();
  });

  it('should connect an audio element and create a node graph', () => {
    const audioEl = document.createElement('audio');
    engine.connect('clip-1', audioEl);

    expect(engine.hasGraph('clip-1')).toBe(true);
    expect(mockCtx.createMediaElementSource).toHaveBeenCalled();
    expect(mockCtx.createBiquadFilter).toHaveBeenCalledTimes(4); // highpass + 3 EQ
    expect(mockCtx.createDelay).toHaveBeenCalledTimes(1);
    // createGain: echoFeedback + echoMix + echoDry + reverbMix + reverbDry + gain + echoMerge + reverbMerge = 8
    expect(mockCtx.createGain).toHaveBeenCalledTimes(8);
    expect(mockCtx.createConvolver).toHaveBeenCalledTimes(1);
  });

  it('should not recreate graph if same element is connected again', () => {
    const audioEl = document.createElement('audio');
    engine.connect('clip-1', audioEl);

    const callCount = mockCtx.createMediaElementSource.mock.calls.length;
    engine.connect('clip-1', audioEl);

    // Should not create any new nodes
    expect(mockCtx.createMediaElementSource).toHaveBeenCalledTimes(callCount);
  });

  it('should disconnect and recreate graph when a different element is connected', () => {
    const audioEl1 = document.createElement('audio');
    const audioEl2 = document.createElement('audio');
    engine.connect('clip-1', audioEl1);

    const callCount = mockCtx.createMediaElementSource.mock.calls.length;
    engine.connect('clip-1', audioEl2);

    expect(mockCtx.createMediaElementSource).toHaveBeenCalledTimes(callCount + 1);
    expect(engine.hasGraph('clip-1')).toBe(true);
  });

  it('should update effects parameters without throwing', () => {
    const audioEl = document.createElement('audio');
    engine.connect('clip-1', audioEl);

    const effects: ClipEffects = {
      ...DEFAULT_EFFECTS,
      eqLow: 6,
      eqMid: -3,
      eqHigh: 2,
      highpassFreq: 200,
      echoDelay: 500,
      echoDecay: 0.5,
      reverbAmount: 0.7,
    };

    expect(() => engine.updateEffects('clip-1', effects, 0.8)).not.toThrow();
  });

  it('should do nothing when updating effects for nonexistent clip', () => {
    expect(() => engine.updateEffects('nonexistent', DEFAULT_EFFECTS, 1.0)).not.toThrow();
  });

  it('should disconnect a clip', () => {
    const audioEl = document.createElement('audio');
    engine.connect('clip-1', audioEl);
    expect(engine.hasGraph('clip-1')).toBe(true);

    engine.disconnect('clip-1');
    expect(engine.hasGraph('clip-1')).toBe(false);
  });

  it('should dispose all graphs and close context', () => {
    const audioEl1 = document.createElement('audio');
    const audioEl2 = document.createElement('audio');
    engine.connect('clip-1', audioEl1);
    engine.connect('clip-2', audioEl2);

    engine.dispose();

    expect(engine.hasGraph('clip-1')).toBe(false);
    expect(engine.hasGraph('clip-2')).toBe(false);
    expect(mockCtx.close).toHaveBeenCalled();
  });

  it('should resume suspended AudioContext', () => {
    // Create a custom mock that starts suspended
    (AudioContext as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(function () {
      mockCtx = createMockAudioContext();
      mockCtx.state = 'suspended';
      return mockCtx;
    });

    const freshEngine = new AudioEngine();
    const audioEl = document.createElement('audio');
    freshEngine.connect('clip-1', audioEl);

    expect(mockCtx.resume).toHaveBeenCalled();
  });

  it('should handle echo off (delay=0) correctly', () => {
    const audioEl = document.createElement('audio');
    engine.connect('clip-1', audioEl);

    const effects: ClipEffects = {
      ...DEFAULT_EFFECTS,
      echoDelay: 0,
      echoDecay: 0.3,
    };

    expect(() => engine.updateEffects('clip-1', effects, 1.0)).not.toThrow();
  });

  it('should handle reverb off (amount=0) correctly', () => {
    const audioEl = document.createElement('audio');
    engine.connect('clip-1', audioEl);

    const effects: ClipEffects = {
      ...DEFAULT_EFFECTS,
      reverbAmount: 0,
    };

    expect(() => engine.updateEffects('clip-1', effects, 1.0)).not.toThrow();
  });

  it('should handle muted volume (0) correctly', () => {
    const audioEl = document.createElement('audio');
    engine.connect('clip-1', audioEl);

    expect(() => engine.updateEffects('clip-1', DEFAULT_EFFECTS, 0)).not.toThrow();
  });
});
