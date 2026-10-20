// 이펙트 하나(리버브·딜레이·코러스). 모노로 받아 스테레오로 낸다.
// 입력 → 로우컷 → 하이컷 → [종류별 그래프] → 출력. 종류를 바꾸면 그 종류의 노드만 새로 만든다
// (쓰지 않는 리버브 컨볼버가 계속 돌지 않게).
//
// 리버브: 프리딜레이 → ConvolverNode(dsp/reverb.ts가 만든 잔향). 잔향 길이·하이컷이 바뀌면 잔향을 다시 만든다.
// 딜레이: DelayNode → 출력, 그리고 DelayNode → 하이컷 → 피드백 → DelayNode(반복할수록 어두워진다).
// 코러스: 왼쪽·오른쪽 DelayNode의 시간을 LFO로 서로 반대로 흔든다.

import { reverbImpulse } from '../dsp/reverb';
import { RAMP } from '../peq';
import type { FxState, FxType } from '../../stores/mixer-model';

const IR_DEBOUNCE_MS = 150;
const CHORUS_BASE_S = 0.012;
const CHORUS_MAX_DEPTH_S = 0.005;

export class FxUnit {
  readonly input: GainNode;
  readonly output: GainNode;
  private loCut: BiquadFilterNode;
  private hiCut: BiquadFilterNode;
  private type: FxType | null = null;
  private nodes: AudioNode[] = [];
  private lfo: OscillatorNode | null = null;
  // 리버브
  private preDelay: DelayNode | null = null;
  private convolver: ConvolverNode | null = null;
  private irKey = '';
  private irTimer: ReturnType<typeof setTimeout> | null = null;
  // 딜레이
  private delay: DelayNode | null = null;
  private fbFilter: BiquadFilterNode | null = null;
  private feedback: GainNode | null = null;
  // 코러스
  private depthL: GainNode | null = null;
  private depthR: GainNode | null = null;

  constructor(private ctx: BaseAudioContext) {
    const mono = { channelCount: 1, channelCountMode: 'explicit' as const, channelInterpretation: 'speakers' as const };
    this.input = new GainNode(ctx, mono);
    this.loCut = new BiquadFilterNode(ctx, { ...mono, type: 'highpass', frequency: 20, Q: 0.707 });
    this.hiCut = new BiquadFilterNode(ctx, { ...mono, type: 'lowpass', frequency: 20000, Q: 0.707 });
    this.output = new GainNode(ctx, { channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'speakers' });
    this.input.connect(this.loCut).connect(this.hiCut);
  }

  apply(f: FxState): void {
    const t = this.ctx.currentTime;
    // 막 만든 노드는 기본값에서 미끄러지지 않게 바로 맞추고, 그 뒤로는 램프한다.
    const fresh = f.type !== this.type;
    if (fresh) this.build(f.type);
    const to = (p: AudioParam | undefined, v: number, tc = RAMP) => (fresh ? p?.setValueAtTime(v, t) : p?.setTargetAtTime(v, t, tc));
    to(this.loCut.frequency, f.loCutHz);
    to(this.hiCut.frequency, f.hiCutHz);
    if (f.type === 'reverb') {
      to(this.preDelay?.delayTime, f.preDelayMs / 1000);
      this.updateImpulse(f);
    } else if (f.type === 'delay') {
      // 딜레이 시간은 조금 길게 램프한다(짧으면 음정이 튄다).
      to(this.delay?.delayTime, f.timeMs / 1000, 0.05);
      to(this.fbFilter?.frequency, f.hiCutHz);
      to(this.feedback?.gain, f.feedbackPct / 100);
    } else {
      to(this.lfo?.frequency, f.rateHz);
      const d = (f.depthPct / 100) * CHORUS_MAX_DEPTH_S;
      to(this.depthL?.gain, d);
      to(this.depthR?.gain, -d);
    }
  }

  private build(type: FxType): void {
    this.teardown();
    const ctx = this.ctx;
    this.type = type;
    if (type === 'reverb') {
      this.preDelay = new DelayNode(ctx, { maxDelayTime: 0.25, delayTime: 0.02 });
      this.convolver = new ConvolverNode(ctx, { disableNormalization: true });
      this.hiCut.connect(this.preDelay).connect(this.convolver).connect(this.output);
      this.nodes = [this.preDelay, this.convolver];
    } else if (type === 'delay') {
      this.delay = new DelayNode(ctx, { maxDelayTime: 3.1, delayTime: 0.375 });
      this.fbFilter = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 6000, Q: 0.707 });
      this.feedback = new GainNode(ctx, { gain: 0.3 });
      this.hiCut.connect(this.delay).connect(this.output);
      this.delay.connect(this.fbFilter).connect(this.feedback).connect(this.delay);
      this.nodes = [this.delay, this.fbFilter, this.feedback];
    } else {
      const dl = new DelayNode(ctx, { maxDelayTime: 0.05, delayTime: CHORUS_BASE_S });
      const dr = new DelayNode(ctx, { maxDelayTime: 0.05, delayTime: CHORUS_BASE_S });
      const merger = new ChannelMergerNode(ctx, { numberOfInputs: 2 });
      this.lfo = new OscillatorNode(ctx, { type: 'sine', frequency: 0.8 });
      this.depthL = new GainNode(ctx, { gain: 0 });
      this.depthR = new GainNode(ctx, { gain: 0 });
      this.lfo.connect(this.depthL).connect(dl.delayTime);
      this.lfo.connect(this.depthR).connect(dr.delayTime);
      this.hiCut.connect(dl).connect(merger, 0, 0);
      this.hiCut.connect(dr).connect(merger, 0, 1);
      merger.connect(this.output);
      this.lfo.start();
      this.nodes = [dl, dr, merger, this.depthL, this.depthR];
    }
  }

  private updateImpulse(f: FxState): void {
    const key = `${f.decayS}|${f.hiCutHz}`;
    if (key === this.irKey || !this.convolver) return;
    this.irKey = key;
    const set = () => {
      this.irTimer = null;
      if (!this.convolver) return;
      const [l, r] = reverbImpulse(this.ctx.sampleRate, { decayS: f.decayS, hiCutHz: f.hiCutHz });
      const buf = this.ctx.createBuffer(2, l.length, this.ctx.sampleRate);
      buf.copyToChannel(l, 0);
      buf.copyToChannel(r, 1);
      this.convolver.buffer = buf;
    };
    // 처음 한 번과 오프라인 렌더링(테스트)은 바로, 실시간에서 슬라이더를 끄는 동안은 멈췄을 때 한 번만 만든다.
    const realtime = typeof AudioContext !== 'undefined' && this.ctx instanceof AudioContext;
    if (!this.convolver.buffer || !realtime) return set();
    if (this.irTimer) clearTimeout(this.irTimer);
    this.irTimer = setTimeout(set, IR_DEBOUNCE_MS);
  }

  private teardown(): void {
    this.hiCut.disconnect();
    if (this.lfo) {
      this.lfo.stop();
      this.lfo.disconnect();
    }
    for (const n of this.nodes) n.disconnect();
    if (this.irTimer) clearTimeout(this.irTimer);
    this.nodes = [];
    this.lfo = this.preDelay = this.convolver = this.delay = this.fbFilter = this.feedback = null;
    this.depthL = this.depthR = null;
    this.irKey = '';
    this.irTimer = null;
  }

  dispose(): void {
    this.teardown();
    this.input.disconnect();
    this.output.disconnect();
  }
}
