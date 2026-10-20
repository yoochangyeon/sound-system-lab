// 컴프레서·게이트·안전 리미터를 하나의 AudioWorkletProcessor로 감싼다.
// 처리 자체는 dsp/dynamics.ts의 순수 코드이고, 여기서는 파라미터와 GR 보고만 한다.

import { Compressor, Gate, SafetyLimiter, type DetectorMode } from '../dsp/dynamics';

// AudioWorkletGlobalScope 타입(TS 기본 lib에 없다)
declare const sampleRate: number;
declare function registerProcessor(name: string, ctor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: unknown);
}

export type DynamicsKind = 'comp' | 'gate' | 'limiter';

const REPORT_EVERY_BLOCKS = 12; // 128 샘플 × 12 ≈ 32 ms

class DynamicsProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    const k = (name: string, defaultValue: number, minValue: number, maxValue: number) => ({
      name,
      defaultValue,
      minValue,
      maxValue,
      automationRate: 'k-rate',
    });
    return [
      k('threshold', -20, -120, 24),
      k('ratio', 3, 1, 1000),
      k('knee', 0, 0, 24),
      k('attack', 10, 0, 1000),
      k('release', 150, 0, 10000),
      k('makeup', 0, -24, 48),
      k('range', 40, 0, 120),
      k('hold', 50, 0, 5000),
      k('detector', 0, 0, 1), // 0 = peak, 1 = rms
      k('bypass', 0, 0, 1),
    ];
  }

  private kind: DynamicsKind;
  private comp: Compressor;
  private gate: Gate;
  private limiter: SafetyLimiter;
  private blocks = 0;

  constructor(options: { processorOptions?: { kind?: DynamicsKind } }) {
    super();
    this.kind = options?.processorOptions?.kind ?? 'comp';
    this.comp = new Compressor(sampleRate);
    this.gate = new Gate(sampleRate);
    this.limiter = new SafetyLimiter(sampleRate);
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][], params: Record<string, Float32Array>): boolean {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) {
      for (const ch of output) ch.fill(0);
      return true;
    }
    for (let c = 0; c < output.length; c++) output[c].set(input[Math.min(c, input.length - 1)]);
    const p = (n: string) => params[n][0];
    const bypass = p('bypass') >= 0.5;

    if (this.kind === 'comp') {
      const detector: DetectorMode = p('detector') >= 0.5 ? 'rms' : 'peak';
      this.comp.process(
        output,
        {
          thresholdDb: p('threshold'),
          ratio: p('ratio') >= 999 ? Infinity : p('ratio'),
          kneeDb: p('knee'),
          attackMs: p('attack'),
          releaseMs: p('release'),
          makeupDb: p('makeup'),
          detector,
        },
        bypass,
      );
    } else if (this.kind === 'gate') {
      this.gate.process(
        output,
        { thresholdDb: p('threshold'), rangeDb: p('range'), attackMs: p('attack'), holdMs: p('hold'), releaseMs: p('release') },
        bypass,
      );
    } else {
      this.limiter.process(output);
    }

    if (++this.blocks >= REPORT_EVERY_BLOCKS) {
      this.blocks = 0;
      const gr = this.kind === 'comp' ? this.comp.grDb : this.kind === 'gate' ? this.gate.grDb : this.limiter.grDb;
      this.port.postMessage({ gr: bypass ? 0 : gr, open: this.gate.open });
    }
    return true;
  }
}

registerProcessor('dynamics', DynamicsProcessor);
