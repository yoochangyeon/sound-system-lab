// 입력 채널 하나의 신호 경로.
// 입력 → 프리엠프 게인 → 디지털 클리핑 → [입력 미터] → 극성 → 채널 딜레이 → HPF → LPF → 게이트 → PEQ → 컴프
//   → 인서트(원음 + 이펙트) → 페이더·뮤트 → [페이더 미터] → 팬 → 메인 할당 → 메인 버스
//   ↘ 버스 센드(pre-eq: 게이트 뒤, pre: 컴프 뒤, post: 페이더 뒤)
// 게이트·컴프의 입력 1은 키(사이드체인): 키 소스 → 키 필터 → 워클릿. 자기 채널을 필터 없이
// 들을 때는 연결하지 않는다(워클릿이 본 신호로 검출한다).

import { BUTTERWORTH_Q_DB } from './dsp/biquad';
import { dbToGain } from './dsp/units';
import { FxUnit } from './fx/fx-unit';
import { Peq, RAMP } from './peq';
import type { BusKind, ChannelState, CompState, KeyFilter, KeyState } from '../stores/mixer-model';

const GATE_MODE = { gate: 0, exp: 1, duck: 2 } as const;
const KEY_FILTER: Record<KeyFilter, BiquadFilterType> = {
  off: 'allpass',
  lowcut: 'highpass',
  highcut: 'lowpass',
  band: 'bandpass',
};

/** 다이내믹스 하나의 키 경로. 연결된 키 소스를 기억해 바뀔 때만 다시 잇는다. */
class KeyPath {
  readonly input: GainNode;
  readonly filter: BiquadFilterNode;
  private source: AudioNode | null = null;
  constructor(
    ctx: BaseAudioContext,
    private target: AudioWorkletNode,
  ) {
    const mono = { channelCount: 1, channelCountMode: 'explicit' as const, channelInterpretation: 'speakers' as const };
    this.input = new GainNode(ctx, mono);
    this.filter = new BiquadFilterNode(ctx, { ...mono, type: 'allpass', frequency: 1000, Q: 2 });
    this.input.connect(this.filter).connect(target, 0, 1);
  }
  apply(k: KeyState, source: AudioNode | null, t: number): void {
    const type = KEY_FILTER[k.filter];
    if (this.filter.type !== type) this.filter.type = type;
    this.filter.frequency.setTargetAtTime(k.freq, t, RAMP);
    if (source === this.source) return;
    // 키 여부는 바로 바꾼다(램프하면 그 사이에 엉뚱한 신호로 검출한다).
    this.target.parameters.get('keyed')?.setValueAtTime(source ? 1 : 0, t);
    this.source?.disconnect(this.input);
    source?.connect(this.input);
    this.source = source;
  }
}

/** 컴프 상태를 워클릿 파라미터로 옮긴다(키 경로는 따로). 채널·버스가 같이 쓴다. */
export function applyCompParams(node: AudioWorkletNode, c: CompState, t: number): void {
  const set = (name: string, v: number) => node.parameters.get(name)?.setTargetAtTime(v, t, RAMP);
  set('threshold', c.thresholdDb);
  set('ratio', c.ratio);
  set('knee', c.kneeDb);
  set('attack', c.attackMs);
  set('release', c.releaseMs);
  set('makeup', c.makeupDb);
  set('detector', c.detector === 'rms' ? 1 : 0);
  set('bypass', c.on ? 0 : 1);
  set('mode', c.mode === 'exp' ? 1 : 0);
  set('mix', c.mixPct);
  set('listen', c.key.listen ? 1 : 0);
}

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
  readonly polarity: GainNode;
  readonly delay: DelayNode;
  readonly hpf: BiquadFilterNode;
  readonly lpf: BiquadFilterNode;
  readonly gate: AudioWorkletNode;
  readonly peq: Peq;
  readonly comp: AudioWorkletNode;
  readonly insertDry: GainNode;
  readonly insertWet: GainNode;
  /** 인서트 뒤(원음 + 이펙트). 페이더와 pre 센드가 여기서 받는다 */
  readonly insertOut: GainNode;
  /** 인서트 이펙트. 처음 켤 때 만든다 */
  insertFx: FxUnit | null = null;
  private insertWired = false;
  readonly fader: GainNode;
  readonly faderMeter: AnalyserNode;
  readonly panner: StereoPannerNode;
  readonly mainSend: GainNode;
  /** 솔로 버스로 가는 길: PFL은 페이더 앞(인서트 뒤, 뮤트와 상관없이), AFL은 팬 뒤 */
  readonly soloPfl: GainNode;
  readonly soloAfl: GainNode;
  readonly sendsPreEq: GainNode[];
  readonly sendsPre: GainNode[];
  readonly sendsPost: GainNode[];
  /** 그룹 버스로 가는 스테레오 센드(팬 뒤, 페이더 뒤) */
  readonly sendsGroup: GainNode[];
  /** 다른 채널이 이 채널을 키로 들을 때 쓰는 자리(필터 뒤, 다이내믹스 앞) */
  readonly keyTap: AudioNode;
  readonly gateKey: KeyPath;
  readonly compKey: KeyPath;

  gateGrDb = 0;
  gateOpen = false;
  compGrDb = 0;

  constructor(
    private ctx: BaseAudioContext,
    private busKinds: BusKind[],
  ) {
    const auxCount = busKinds.length;
    const mono = { channelCount: 1, channelCountMode: 'explicit' as const, channelInterpretation: 'speakers' as const };
    this.input = new GainNode(ctx, { ...mono, gain: 1 });
    this.preamp = new GainNode(ctx, mono);
    this.clipper = new WaveShaperNode(ctx, { ...mono, curve: clipCurve() });
    this.inputMeter = new AnalyserNode(ctx, { fftSize: 1024 });
    this.polarity = new GainNode(ctx, { ...mono, gain: 1 });
    this.delay = new DelayNode(ctx, { ...mono, maxDelayTime: 0.5, delayTime: 0 });
    this.hpf = new BiquadFilterNode(ctx, { ...mono, type: 'allpass', frequency: 80, Q: BUTTERWORTH_Q_DB });
    this.lpf = new BiquadFilterNode(ctx, { ...mono, type: 'allpass', frequency: 20000, Q: BUTTERWORTH_Q_DB });
    this.gate = new AudioWorkletNode(ctx, 'dynamics', {
      numberOfInputs: 2,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: { kind: 'gate' },
    });
    this.peq = new Peq(ctx);
    this.comp = new AudioWorkletNode(ctx, 'dynamics', {
      numberOfInputs: 2,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: { kind: 'comp' },
    });
    this.soloPfl = new GainNode(ctx, { ...mono, gain: 0 });
    this.soloAfl = new GainNode(ctx, { gain: 0 });
    this.insertDry = new GainNode(ctx, { ...mono, gain: 1 });
    this.insertWet = new GainNode(ctx, { ...mono, gain: 0 });
    this.insertOut = new GainNode(ctx, mono);
    this.fader = new GainNode(ctx, mono);
    this.faderMeter = new AnalyserNode(ctx, { fftSize: 1024 });
    this.panner = new StereoPannerNode(ctx);
    this.mainSend = new GainNode(ctx);
    this.sendsPreEq = Array.from({ length: auxCount }, () => new GainNode(ctx, { ...mono, gain: 0 }));
    this.sendsPre = Array.from({ length: auxCount }, () => new GainNode(ctx, { ...mono, gain: 0 }));
    this.sendsPost = Array.from({ length: auxCount }, () => new GainNode(ctx, { ...mono, gain: 0 }));
    this.sendsGroup = Array.from({ length: auxCount }, () => new GainNode(ctx, { gain: 0 }));

    this.keyTap = this.lpf;
    this.gateKey = new KeyPath(ctx, this.gate);
    this.compKey = new KeyPath(ctx, this.comp);

    this.input.connect(this.preamp).connect(this.clipper);
    this.clipper.connect(this.inputMeter);
    this.clipper.connect(this.polarity).connect(this.delay).connect(this.hpf).connect(this.lpf).connect(this.gate).connect(this.peq.input);
    this.peq.output.connect(this.comp).connect(this.insertDry).connect(this.insertOut);
    this.insertWet.connect(this.insertOut);
    this.insertOut.connect(this.fader).connect(this.panner).connect(this.mainSend);
    this.insertOut.connect(this.soloPfl);
    this.panner.connect(this.soloAfl);
    this.fader.connect(this.faderMeter);
    this.sendsPreEq.forEach((g) => this.gate.connect(g));
    this.sendsPre.forEach((g) => this.insertOut.connect(g));
    this.sendsPost.forEach((g) => this.fader.connect(g));
    this.sendsGroup.forEach((g) => this.panner.connect(g));

    this.gate.port.onmessage = (e) => {
      this.gateGrDb = e.data.gr;
      this.gateOpen = e.data.open;
    };
    this.comp.port.onmessage = (e) => {
      this.compGrDb = e.data.gr;
    };
  }

  /** 상태를 노드 파라미터로 옮긴다. peers는 다른 채널을 키 소스로 찾을 때 쓴다. */
  apply(s: ChannelState, peers: ChannelStrip[] = []): void {
    const t = this.ctx.currentTime;
    const ramp = (p: AudioParam, v: number) => p.setTargetAtTime(v, t, RAMP);
    const set = (node: AudioWorkletNode, name: string, v: number) => {
      const p = node.parameters.get(name);
      if (p) ramp(p, v);
    };

    ramp(this.preamp.gain, gainOf(s.preamp.gainDb));
    // 극성은 바로 뒤집는다(램프하면 그 사이 소리가 0을 지나며 작아진다).
    this.polarity.gain.setValueAtTime(s.preamp.invert ? -1 : 1, t);
    ramp(this.delay.delayTime, s.preamp.delayOn ? s.preamp.delayMs / 1000 : 0);
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
    set(this.gate, 'mode', GATE_MODE[s.gate.mode]);
    set(this.gate, 'expRatio', s.gate.expRatio);
    set(this.gate, 'listen', s.gate.key.listen ? 1 : 0);
    this.gateKey.apply(s.gate.key, this.keySource(s.gate.on, s.gate.key, this.lpf, peers), t);

    this.peq.apply(s.peq);

    applyCompParams(this.comp, s.comp, t);
    this.compKey.apply(s.comp.key, this.keySource(s.comp.on, s.comp.key, this.peq.output, peers), t);

    this.applyInsert(s, t);

    ramp(this.fader.gain, s.mute ? 0 : gainOf(s.faderDb));
    ramp(this.panner.pan, s.pan);
    ramp(this.mainSend.gain, s.mainAssign ? 1 : 0);
    s.sends.forEach((send, i) => {
      const g = s.mute ? 0 : gainOf(send.levelDb);
      // 그룹은 탭과 상관없이 팬 뒤(페이더 뒤) 스테레오로 받는다.
      const group = this.busKinds[i] === 'group';
      if (this.sendsPreEq[i]) ramp(this.sendsPreEq[i].gain, !group && send.tap === 'pre-eq' ? g : 0);
      if (this.sendsPre[i]) ramp(this.sendsPre[i].gain, !group && send.tap === 'pre' ? g : 0);
      if (this.sendsPost[i]) ramp(this.sendsPost[i].gain, !group && send.tap === 'post' ? g : 0);
      if (this.sendsGroup[i]) ramp(this.sendsGroup[i].gain, group ? g : 0);
    });
  }

  /** 인서트: 켜면 컴프 뒤 소리를 이펙트에 넣고 원음과 섞는다. 끄면 이펙트 입력을 끊어 처리하지 않는다. */
  private applyInsert(s: ChannelState, t: number): void {
    const on = s.insert.on;
    if (on && !this.insertFx) {
      this.insertFx = new FxUnit(this.ctx);
      this.insertFx.output.connect(this.insertWet);
    }
    if (on !== this.insertWired && this.insertFx) {
      if (on) this.comp.connect(this.insertFx.input);
      else this.comp.disconnect(this.insertFx.input);
      this.insertWired = on;
    }
    if (on) this.insertFx?.apply(s.insert.fx);
    const wet = on ? s.insert.mixPct / 100 : 0;
    this.insertDry.gain.setTargetAtTime(1 - wet, t, RAMP);
    this.insertWet.gain.setTargetAtTime(wet, t, RAMP);
  }

  /** 키로 이을 노드. 꺼져 있거나 자기 소리를 그대로 들으면 잇지 않는다. */
  private keySource(on: boolean, k: KeyState, self: AudioNode, peers: ChannelStrip[]): AudioNode | null {
    if (!on) return null;
    const peer = typeof k.source === 'number' ? peers[k.source] : undefined;
    if (peer && peer !== this) return peer.keyTap;
    return k.filter !== 'off' || k.listen ? self : null;
  }

  disconnect(): void {
    for (const n of [this.input, this.mainSend, this.soloPfl, this.soloAfl, ...this.sendsPreEq, ...this.sendsPre, ...this.sendsPost, ...this.sendsGroup]) n.disconnect();
    this.gate.port.onmessage = null;
    this.comp.port.onmessage = null;
    this.insertFx?.dispose();
  }
}
