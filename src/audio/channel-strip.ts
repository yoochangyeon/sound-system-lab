// 입력 채널 하나의 신호 경로.
// 입력 → 프리엠프 게인 → 디지털 클리핑 → [입력 미터] → HPF → LPF → 게이트 → PEQ → 컴프
//   → 페이더·뮤트 → [페이더 미터] → 팬 → 메인 할당 → 메인 버스
//   ↘ Aux 센드(pre: 컴프 뒤, post: 페이더 뒤)

import { BUTTERWORTH_Q_DB } from './dsp/biquad';
import { dbToGain } from './dsp/units';
import { Peq, RAMP } from './peq';
import type { ChannelState } from '../stores/mixer-model';

function gainOf(db: number): number {
  return db === -Infinity ? 0 : dbToGain(db);
}

/** 디지털 클리핑: ±1(0 dBFS) 밖의 값은 곡선 끝값으로 잘린다(WaveShaperNode 명세). */
function clipCurve(): Float32Array<ArrayBuffer> {
  return new Float32Array([-1, 1]);
}

export class ChannelStrip {
  readonly input: GainNode;
  readonly preamp: GainNode;
  readonly clipper: WaveShaperNode;
  readonly inputMeter: AnalyserNode;
  readonly hpf: BiquadFilterNode;
  readonly lpf: BiquadFilterNode;
  readonly gate: AudioWorkletNode;
  readonly peq: Peq;
  readonly comp: AudioWorkletNode;
  readonly fader: GainNode;
  readonly faderMeter: AnalyserNode;
  readonly panner: StereoPannerNode;
  readonly mainSend: GainNode;
  readonly sendsPre: GainNode[];
  readonly sendsPost: GainNode[];

  gateGrDb = 0;
  gateOpen = false;
  compGrDb = 0;

  constructor(
    private ctx: BaseAudioContext,
    auxCount: number,
  ) {
    const mono = { channelCount: 1, channelCountMode: 'explicit' as const, channelInterpretation: 'speakers' as const };
    this.input = new GainNode(ctx, { ...mono, gain: 1 });
    this.preamp = new GainNode(ctx, mono);
    this.clipper = new WaveShaperNode(ctx, { ...mono, curve: clipCurve() });
    this.inputMeter = new AnalyserNode(ctx, { fftSize: 1024 });
    this.hpf = new BiquadFilterNode(ctx, { ...mono, type: 'allpass', frequency: 80, Q: BUTTERWORTH_Q_DB });
    this.lpf = new BiquadFilterNode(ctx, { ...mono, type: 'allpass', frequency: 20000, Q: BUTTERWORTH_Q_DB });
    this.gate = new AudioWorkletNode(ctx, 'dynamics', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: { kind: 'gate' },
    });
    this.peq = new Peq(ctx);
    this.comp = new AudioWorkletNode(ctx, 'dynamics', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: { kind: 'comp' },
    });
    this.fader = new GainNode(ctx, mono);
    this.faderMeter = new AnalyserNode(ctx, { fftSize: 1024 });
    this.panner = new StereoPannerNode(ctx);
    this.mainSend = new GainNode(ctx);
    this.sendsPre = Array.from({ length: auxCount }, () => new GainNode(ctx, { ...mono, gain: 0 }));
    this.sendsPost = Array.from({ length: auxCount }, () => new GainNode(ctx, { ...mono, gain: 0 }));

    this.input.connect(this.preamp).connect(this.clipper);
    this.clipper.connect(this.inputMeter);
    this.clipper.connect(this.hpf).connect(this.lpf).connect(this.gate).connect(this.peq.input);
    this.peq.output.connect(this.comp).connect(this.fader).connect(this.panner).connect(this.mainSend);
    this.fader.connect(this.faderMeter);
    this.sendsPre.forEach((g) => this.comp.connect(g));
    this.sendsPost.forEach((g) => this.fader.connect(g));

    this.gate.port.onmessage = (e) => {
      this.gateGrDb = e.data.gr;
      this.gateOpen = e.data.open;
    };
    this.comp.port.onmessage = (e) => {
      this.compGrDb = e.data.gr;
    };
  }

  /** 상태를 노드 파라미터로 옮긴다. */
  apply(s: ChannelState): void {
    const t = this.ctx.currentTime;
    const ramp = (p: AudioParam, v: number) => p.setTargetAtTime(v, t, RAMP);
    const set = (node: AudioWorkletNode, name: string, v: number) => {
      const p = node.parameters.get(name);
      if (p) ramp(p, v);
    };

    ramp(this.preamp.gain, gainOf(s.preamp.gainDb));
    const hpfType: BiquadFilterType = s.preamp.hpfOn ? 'highpass' : 'allpass';
    if (this.hpf.type !== hpfType) this.hpf.type = hpfType;
    ramp(this.hpf.frequency, s.preamp.hpfOn ? s.preamp.hpfFreq : 20);
    // allpass일 때 Q는 선형이므로 크기에는 영향이 없다. highpass는 dB 단위 Q로 버터워스.
    ramp(this.hpf.Q, s.preamp.hpfOn ? BUTTERWORTH_Q_DB : 0.7);
    const lpfType: BiquadFilterType = s.preamp.lpfOn ? 'lowpass' : 'allpass';
    if (this.lpf.type !== lpfType) this.lpf.type = lpfType;
    ramp(this.lpf.frequency, s.preamp.lpfOn ? s.preamp.lpfFreq : 20000);
    ramp(this.lpf.Q, s.preamp.lpfOn ? BUTTERWORTH_Q_DB : 0.7);

    set(this.gate, 'threshold', s.gate.thresholdDb);
    set(this.gate, 'range', s.gate.rangeDb);
    set(this.gate, 'attack', s.gate.attackMs);
    set(this.gate, 'hold', s.gate.holdMs);
    set(this.gate, 'release', s.gate.releaseMs);
    set(this.gate, 'bypass', s.gate.on ? 0 : 1);

    this.peq.apply(s.peq);

    set(this.comp, 'threshold', s.comp.thresholdDb);
    set(this.comp, 'ratio', s.comp.ratio);
    set(this.comp, 'knee', s.comp.kneeDb);
    set(this.comp, 'attack', s.comp.attackMs);
    set(this.comp, 'release', s.comp.releaseMs);
    set(this.comp, 'makeup', s.comp.makeupDb);
    set(this.comp, 'detector', s.comp.detector === 'rms' ? 1 : 0);
    set(this.comp, 'bypass', s.comp.on ? 0 : 1);

    ramp(this.fader.gain, s.mute ? 0 : gainOf(s.faderDb));
    ramp(this.panner.pan, s.pan);
    ramp(this.mainSend.gain, s.mainAssign ? 1 : 0);
    s.sends.forEach((send, i) => {
      const g = s.mute ? 0 : gainOf(send.levelDb);
      if (this.sendsPre[i]) ramp(this.sendsPre[i].gain, send.pre ? g : 0);
      if (this.sendsPost[i]) ramp(this.sendsPost[i].gain, send.pre ? 0 : g);
    });
  }

  disconnect(): void {
    for (const n of [this.input, this.mainSend, ...this.sendsPre, ...this.sendsPost]) n.disconnect();
    this.gate.port.onmessage = null;
    this.comp.port.onmessage = null;
  }
}
