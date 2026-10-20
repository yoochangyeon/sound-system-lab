// 출력 버스(메인 L/R, Aux): 입력 → GEQ 31밴드 → 페이더·뮤트 → 출력.
// RTA·미터는 페이더 뒤에서 잰다.

import { GEQ_FREQS, GEQ_Q } from './dsp/geq';
import { dbToGain } from './dsp/units';
import { RAMP } from './peq';
import type { BusState } from '../stores/mixer-model';

export class Bus {
  readonly input: GainNode;
  readonly geq: BiquadFilterNode[];
  readonly fader: GainNode;
  readonly analyser: AnalyserNode;

  constructor(
    private ctx: BaseAudioContext,
    channels: 1 | 2,
  ) {
    const opts = { channelCount: channels, channelCountMode: 'explicit' as const, channelInterpretation: 'speakers' as const };
    this.input = new GainNode(ctx, opts);
    this.geq = GEQ_FREQS.map((frequency) => new BiquadFilterNode(ctx, { ...opts, type: 'peaking', frequency, Q: GEQ_Q, gain: 0 }));
    this.fader = new GainNode(ctx, opts);
    this.analyser = new AnalyserNode(ctx, { fftSize: 8192, smoothingTimeConstant: 0.6 });
    let node: AudioNode = this.input;
    for (const f of this.geq) node = node.connect(f);
    node.connect(this.fader).connect(this.analyser);
  }

  get output(): AudioNode {
    return this.fader;
  }

  apply(s: BusState): void {
    const t = this.ctx.currentTime;
    s.geq.forEach((db, i) => this.geq[i]?.gain.setTargetAtTime(db, t, RAMP));
    this.fader.gain.setTargetAtTime(s.mute || s.faderDb === -Infinity ? 0 : dbToGain(s.faderDb), t, RAMP);
  }
}
