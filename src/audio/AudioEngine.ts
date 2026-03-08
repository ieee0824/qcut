import type { ClipEffects } from '../store/timelineStore';

interface AudioNodeGraph {
  source: MediaElementAudioSourceNode;
  highpass: BiquadFilterNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  echoDelay: DelayNode;
  echoFeedback: GainNode;
  echoMix: GainNode;
  echoDry: GainNode;
  reverbConvolver: ConvolverNode;
  reverbMix: GainNode;
  reverbDry: GainNode;
  gain: GainNode;
}

/**
 * Web Audio API を使って音声エフェクトをリアルタイムにプレビューするエンジン。
 * クリップごとに AudioNodeGraph を構築し、エフェクトパラメータを動的に更新する。
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private graphs: Map<string, AudioNodeGraph> = new Map();
  // HTMLAudioElement は 1つの MediaElementSourceNode にしか接続できないため追跡する
  private connectedElements: Map<string, HTMLAudioElement> = new Map();

  private getContext(): AudioContext | null {
    if (typeof AudioContext === 'undefined') {
      return null;
    }
    if (!this.context || this.context.state === 'closed') {
      this.context = new AudioContext();
    }
    if (this.context.state === 'suspended') {
      this.context.resume();
    }
    return this.context;
  }

  /**
   * HTMLAudioElement をノードグラフに接続する。
   * 同じ clipId で既に接続済みの場合は既存グラフを返す。
   */
  connect(clipId: string, audioElement: HTMLAudioElement): void {
    const existingElement = this.connectedElements.get(clipId);
    if (existingElement === audioElement && this.graphs.has(clipId)) {
      return;
    }

    // 別の要素が接続されていた場合は古いグラフを破棄
    if (this.graphs.has(clipId)) {
      this.disconnect(clipId);
    }

    const ctx = this.getContext();
    if (!ctx) return;

    const source = ctx.createMediaElementSource(audioElement);
    const highpass = ctx.createBiquadFilter();
    const eqLow = ctx.createBiquadFilter();
    const eqMid = ctx.createBiquadFilter();
    const eqHigh = ctx.createBiquadFilter();
    const echoDelay = ctx.createDelay(2.0);
    const echoFeedback = ctx.createGain();
    const echoMix = ctx.createGain();
    const echoDry = ctx.createGain();
    const reverbConvolver = ctx.createConvolver();
    const reverbMix = ctx.createGain();
    const reverbDry = ctx.createGain();
    const gain = ctx.createGain();

    // ハイパスフィルター設定
    highpass.type = 'highpass';
    highpass.frequency.value = 0; // 0 = オフ（全通過）
    highpass.Q.value = 0.707;

    // EQ: Low shelf (100Hz)
    eqLow.type = 'lowshelf';
    eqLow.frequency.value = 100;
    eqLow.gain.value = 0;

    // EQ: Mid peaking (1kHz)
    eqMid.type = 'peaking';
    eqMid.frequency.value = 1000;
    eqMid.Q.value = 1.0;
    eqMid.gain.value = 0;

    // EQ: High shelf (10kHz)
    eqHigh.type = 'highshelf';
    eqHigh.frequency.value = 10000;
    eqHigh.gain.value = 0;

    // エコー初期値
    echoDelay.delayTime.value = 0;
    echoFeedback.gain.value = 0;
    echoMix.gain.value = 0;
    echoDry.gain.value = 1;

    // リバーブ初期値
    reverbConvolver.buffer = this.generateImpulseResponse(ctx, 0);
    reverbMix.gain.value = 0;
    reverbDry.gain.value = 1;

    // ノードグラフの接続:
    // source → highpass → eqLow → eqMid → eqHigh → [echo split] → [reverb split] → gain → destination
    //
    // Echo: input → echoDry → merge
    //        input → echoDelay → echoMix → merge
    //        echoDelay → echoFeedback → echoDelay (feedback loop)
    //
    // Reverb: input → reverbDry → merge
    //          input → reverbConvolver → reverbMix → merge

    source.connect(highpass);
    highpass.connect(eqLow);
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);

    // Echo split
    const echoMerge = ctx.createGain();
    eqHigh.connect(echoDry);
    echoDry.connect(echoMerge);
    eqHigh.connect(echoDelay);
    echoDelay.connect(echoMix);
    echoMix.connect(echoMerge);
    echoDelay.connect(echoFeedback);
    echoFeedback.connect(echoDelay);

    // Reverb split
    const reverbMerge = ctx.createGain();
    echoMerge.connect(reverbDry);
    reverbDry.connect(reverbMerge);
    echoMerge.connect(reverbConvolver);
    reverbConvolver.connect(reverbMix);
    reverbMix.connect(reverbMerge);

    reverbMerge.connect(gain);
    gain.connect(ctx.destination);

    this.graphs.set(clipId, {
      source, highpass, eqLow, eqMid, eqHigh,
      echoDelay, echoFeedback, echoMix, echoDry,
      reverbConvolver, reverbMix, reverbDry,
      gain,
    });
    this.connectedElements.set(clipId, audioElement);
  }

  /**
   * エフェクトパラメータとボリュームをリアルタイム更新する。
   * volume は最終的な合成値（trackVol * clipVol * fade * uiVol）を渡す。
   */
  updateEffects(clipId: string, effects: ClipEffects, combinedVolume: number): void {
    const graph = this.graphs.get(clipId);
    if (!graph) return;

    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // ボリューム
    graph.gain.gain.setTargetAtTime(combinedVolume, now, 0.02);

    // ハイパスフィルター
    const hpFreq = effects.highpassFreq ?? 0;
    graph.highpass.frequency.setTargetAtTime(hpFreq > 0 ? hpFreq : 0, now, 0.02);

    // EQ
    graph.eqLow.gain.setTargetAtTime(effects.eqLow ?? 0, now, 0.02);
    graph.eqMid.gain.setTargetAtTime(effects.eqMid ?? 0, now, 0.02);
    graph.eqHigh.gain.setTargetAtTime(effects.eqHigh ?? 0, now, 0.02);

    // エコー
    const echoDelay = (effects.echoDelay ?? 0) / 1000; // ms → seconds
    const echoDecay = effects.echoDecay ?? 0.3;
    if (echoDelay > 0) {
      graph.echoDelay.delayTime.setTargetAtTime(echoDelay, now, 0.02);
      graph.echoFeedback.gain.setTargetAtTime(echoDecay, now, 0.02);
      graph.echoMix.gain.setTargetAtTime(0.5, now, 0.02);
      graph.echoDry.gain.setTargetAtTime(1, now, 0.02);
    } else {
      graph.echoDelay.delayTime.setTargetAtTime(0, now, 0.02);
      graph.echoFeedback.gain.setTargetAtTime(0, now, 0.02);
      graph.echoMix.gain.setTargetAtTime(0, now, 0.02);
      graph.echoDry.gain.setTargetAtTime(1, now, 0.02);
    }

    // リバーブ
    const reverbAmount = effects.reverbAmount ?? 0;
    if (reverbAmount > 0) {
      // リバーブ量が変わったらインパルスレスポンスを再生成
      const currentBuffer = graph.reverbConvolver.buffer;
      const expectedDuration = 1.0 + reverbAmount * 2.0;
      if (!currentBuffer || Math.abs(currentBuffer.duration - expectedDuration) > 0.1) {
        graph.reverbConvolver.buffer = this.generateImpulseResponse(ctx, reverbAmount);
      }
      graph.reverbMix.gain.setTargetAtTime(reverbAmount, now, 0.02);
      graph.reverbDry.gain.setTargetAtTime(1 - reverbAmount * 0.5, now, 0.02);
    } else {
      graph.reverbMix.gain.setTargetAtTime(0, now, 0.02);
      graph.reverbDry.gain.setTargetAtTime(1, now, 0.02);
    }
  }

  /**
   * クリップのノードグラフを破棄する。
   */
  disconnect(clipId: string): void {
    const graph = this.graphs.get(clipId);
    if (graph) {
      try { graph.source.disconnect(); } catch { /* already disconnected */ }
      try { graph.highpass.disconnect(); } catch { /* already disconnected */ }
      try { graph.eqLow.disconnect(); } catch { /* already disconnected */ }
      try { graph.eqMid.disconnect(); } catch { /* already disconnected */ }
      try { graph.eqHigh.disconnect(); } catch { /* already disconnected */ }
      try { graph.echoDelay.disconnect(); } catch { /* already disconnected */ }
      try { graph.echoFeedback.disconnect(); } catch { /* already disconnected */ }
      try { graph.echoMix.disconnect(); } catch { /* already disconnected */ }
      try { graph.echoDry.disconnect(); } catch { /* already disconnected */ }
      try { graph.reverbConvolver.disconnect(); } catch { /* already disconnected */ }
      try { graph.reverbMix.disconnect(); } catch { /* already disconnected */ }
      try { graph.reverbDry.disconnect(); } catch { /* already disconnected */ }
      try { graph.gain.disconnect(); } catch { /* already disconnected */ }
      this.graphs.delete(clipId);
    }
    this.connectedElements.delete(clipId);
  }

  /**
   * 全てのクリップのグラフを破棄し、AudioContext をクローズする。
   */
  dispose(): void {
    for (const clipId of this.graphs.keys()) {
      this.disconnect(clipId);
    }
    if (this.context && this.context.state !== 'closed') {
      this.context.close();
    }
    this.context = null;
  }

  /**
   * 指定クリップのグラフが存在するかチェック
   */
  hasGraph(clipId: string): boolean {
    return this.graphs.has(clipId);
  }

  /**
   * リバーブ用インパルスレスポンスを生成する。
   * amount: 0〜1（0=短い残響, 1=長い残響）
   */
  private generateImpulseResponse(ctx: AudioContext, amount: number): AudioBuffer {
    const duration = 1.0 + amount * 2.0;
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        // 指数減衰するホワイトノイズ
        const decay = Math.exp(-t / (0.2 + amount * 1.5));
        data[i] = (Math.random() * 2 - 1) * decay;
      }
    }

    return buffer;
  }
}

// シングルトンインスタンス
export const audioEngine = new AudioEngine();
