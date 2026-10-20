// 컴프레서·게이트·안전 리미터를 하나의 AudioWorkletProcessor로 감싼다.
// 처리 자체는 dsp/dynamics.ts의 순수 코드이고, 여기서는 파라미터와 GR 보고만 한다.
// 입력 1은 키(사이드체인)다. keyed가 0이면 본 신호로 검출한다(연결이 없는 입력이
// 빈 배열이 아니라 무음 채널로 오는 브라우저가 있어 연결 여부를 따로 받는다).

import { Compressor, Gate, SafetyLimiter, type DetectorMode, type GateMode } from '../dsp/dynamics';

// AudioWorkletGlobalScope 타입(TS 기본 lib에 없다)
declare const sampleRate: number;
declare function registerProcessor(name: string, ctor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: unknown);
}

export type DynamicsKind = 'comp' | 'gate' | 'limiter';

const GATE_MODES: GateMode[] = ['gate', 'exp', 'duck'];
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
      k('mode', 0, 0, 2), // comp: 0 comp, 1 exp / gate: 0 gate, 1 exp, 2 duck
      k('expRatio', 2, 1, 10),
      k('mix', 100, 0, 100),
      k('listen', 0, 0, 1), // 1이면 처리 대신 키 신호를 내보낸다
      k('keyed', 0, 0, 1), // 1이면 입력 1(키)로 검출한다
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
    const p = (n: string) => params[n][0];
    const bypass = p('bypass') >= 0.5;
    const key = p('keyed') >= 0.5 && inputs[1] && inputs[1].length > 0 ? inputs[1] : undefined;
    if (!bypass && p('listen') >= 0.5) {
      const heard = key ?? input;
      for (let c = 0; c < output.length; c++) output[c].set(heard[Math.min(c, heard.length - 1)]);
      return true;
    }
    for (let c = 0; c < output.length; c++) output[c].set(input[Math.min(c, input.length - 1)]);

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
          mode: p('mode') >= 0.5 ? 'exp' : 'comp',
          mixPct: p('mix'),
        },
        bypass,
        key,
      );
    } else if (this.kind === 'gate') {
      this.gate.process(
        output,
        {
          thresholdDb: p('threshold'),
          rangeDb: p('range'),
          attackMs: p('attack'),
          holdMs: p('hold'),
          releaseMs: p('release'),
          mode: GATE_MODES[Math.round(p('mode'))] ?? 'gate',
          expRatio: p('expRatio'),
        },
        bypass,
        key,
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
