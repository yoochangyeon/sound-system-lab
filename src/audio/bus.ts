// 출력 버스(메인 L/R, 모니터, 그룹): 입력 → PEQ → 컴프 → GEQ 31밴드 → 페이더·뮤트 → 출력.
// RTA·미터는 페이더 뒤에서 잰다. GEQ가 평평하면 31밴드를 건너뛴다(버스가 늘어도 처리량을 줄인다).

import { applyCompParams } from './channel-strip';
import { GEQ_FREQS, GEQ_Q } from './dsp/geq';
import { dbToGain } from './dsp/units';
import { Peq, RAMP } from './peq';
import type { BusState, MatrixState } from '../stores/mixer-model';

function gainOf(db: number): number {
  return db === -Infinity ? 0 : dbToGain(db);
}

export class Bus {
  readonly input: GainNode;
  readonly peq: Peq;
  readonly comp: AudioWorkletNode;
  readonly geq: BiquadFilterNode[];
  readonly fader: GainNode;
  readonly analyser: AnalyserNode;
  compGrDb = 0;
  private geqWired = false;

  constructor(
    private ctx: BaseAudioContext,
    readonly channels: 1 | 2,
  ) {
    const opts = { channelCount: channels, channelCountMode: 'explicit' as const, channelInterpretation: 'speakers' as const };
    this.input = new GainNode(ctx, opts);
    this.peq = new Peq(ctx);
    this.comp = new AudioWorkletNode(ctx, 'dynamics', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [channels],
      processorOptions: { kind: 'comp' },
    });
    this.geq = GEQ_FREQS.map((frequency) => new BiquadFilterNode(ctx, { ...opts, type: 'peaking', frequency, Q: GEQ_Q, gain: 0 }));
    this.fader = new GainNode(ctx, opts);
    this.analyser = new AnalyserNode(ctx, { fftSize: 8192, smoothingTimeConstant: 0.6 });
    for (let i = 1; i < this.geq.length; i++) this.geq[i - 1].connect(this.geq[i]);
    this.input.connect(this.peq.input);
    this.peq.output.connect(this.comp);
    this.comp.connect(this.fader);
    this.fader.connect(this.analyser);
    this.comp.port.onmessage = (e) => {
      this.compGrDb = e.data.gr;
    };
  }

  get output(): AudioNode {
    return this.fader;
  }

  apply(s: BusState): void {
    const t = this.ctx.currentTime;
    this.peq.apply(s.peq);
    applyCompParams(this.comp, s.comp, t);
    s.geq.forEach((db, i) => this.geq[i]?.gain.setTargetAtTime(db, t, RAMP));
    this.wireGeq(s.geq.some((db) => db !== 0));
    this.fader.gain.setTargetAtTime(s.mute ? 0 : gainOf(s.faderDb), t, RAMP);
  }

  /** GEQ를 경로에 넣거나 뺀다. 0 dB peaking은 통과와 같아서 빼도 소리가 같다. */
  private wireGeq(on: boolean): void {
    if (on === this.geqWired) return;
    const last = this.geq[this.geq.length - 1];
    if (on) {
      this.comp.disconnect(this.fader);
      this.comp.connect(this.geq[0]);
      last.connect(this.fader);
    } else {
      this.comp.disconnect(this.geq[0]);
      last.disconnect(this.fader);
      this.comp.connect(this.fader);
    }
    this.geqWired = on;
  }

  disconnect(): void {
    this.comp.port.onmessage = null;
  }
}

/** 매트릭스: 메인과 그룹 출력을 받아 섞는다. */
export class MatrixBus {
  readonly input: GainNode;
  readonly fromMain: GainNode;
  readonly fromBus: GainNode[];
  readonly fader: GainNode;
  readonly analyser: AnalyserNode;

  constructor(
    private ctx: BaseAudioContext,
    main: AudioNode,
    buses: AudioNode[],
  ) {
    const opts = { channelCount: 2, channelCountMode: 'explicit' as const, channelInterpretation: 'speakers' as const };
    this.input = new GainNode(ctx, opts);
    this.fromMain = new GainNode(ctx, { ...opts, gain: 0 });
    this.fromBus = buses.map(() => new GainNode(ctx, { ...opts, gain: 0 }));
    this.fader = new GainNode(ctx, opts);
    this.analyser = new AnalyserNode(ctx, { fftSize: 8192, smoothingTimeConstant: 0.6 });
    main.connect(this.fromMain).connect(this.input);
    buses.forEach((b, i) => b.connect(this.fromBus[i]).connect(this.input));
    this.input.connect(this.fader).connect(this.analyser);
  }

  get output(): AudioNode {
    return this.fader;
  }

  /** busIsGroup[i]가 거짓인 버스(모니터)는 받지 않는다. */
  apply(s: MatrixState, busIsGroup: boolean[]): void {
    const t = this.ctx.currentTime;
    this.fromMain.gain.setTargetAtTime(gainOf(s.fromMainDb), t, RAMP);
    this.fromBus.forEach((g, i) => g.gain.setTargetAtTime(busIsGroup[i] ? gainOf(s.fromBusDb[i] ?? -Infinity) : 0, t, RAMP));
    this.fader.gain.setTargetAtTime(s.mute ? 0 : gainOf(s.faderDb), t, RAMP);
  }
}
