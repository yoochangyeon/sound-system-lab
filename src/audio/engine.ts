// 믹서 엔진: 저장소 상태를 구독해 Web Audio 그래프로 옮긴다.
// 입력(스템) → 패치 → 채널 스트립 → 메인/Aux 버스 → 듣기 선택 → 안전 리미터 → 출력.
// 하울링 톤은 하울링 설정이 켜졌을 때 해당 Aux의 RTA와 최종 출력에 섞인다(듣기 선택과 상관없음).

import { Bus } from './bus';
import { ChannelStrip } from './channel-strip';
import { loadSample } from './context';
import { HOWL_FLOOR_DB, howlStep } from './dsp/feedback';
import { binsToThirdOctave, peakDb } from './dsp/rta';
import { dbToGain } from './dsp/units';
import { RAMP } from './peq';
import { stemById } from './stems';
import { ensureWorklets } from './worklets';
import { howlLoopGainDb } from '../stores/derived';
import type { MixerState } from '../stores/mixer-model';
import type { BusRef, MixerStore, MixerStoreApi } from '../stores/mixer';

export interface EngineOptions {
  /** 최종 출력 대상(기본: ctx.destination) */
  destination?: AudioNode;
  /** 테스트용: 스템 id → 버퍼. 주면 파일을 불러오지 않는다. */
  buffers?: Map<string, AudioBuffer>;
  /** 하울링 계산 주기(ms). 0이면 타이머를 돌리지 않는다(테스트). */
  howlTickMs?: number;
}

export class MixerEngine {
  readonly strips: ChannelStrip[];
  readonly main: Bus;
  readonly auxes: Bus[];
  readonly inputNodes: GainNode[];
  readonly listenMain: GainNode;
  readonly listenAux: GainNode[];
  readonly listenMix: GainNode;
  readonly limiter: AudioWorkletNode;
  readonly howlOsc: OscillatorNode;
  readonly howlGain: GainNode;

  private buffers = new Map<string, AudioBuffer>();
  private sources: AudioBufferSourceNode[] = [];
  private unsubscribe: () => void;
  private howlTimer: ReturnType<typeof setInterval> | null = null;
  private patchWiring: (number | null)[] = [];
  howlLevelDb = HOWL_FLOOR_DB;
  playing = false;

  private constructor(
    readonly ctx: BaseAudioContext,
    private store: MixerStoreApi,
    private opts: EngineOptions,
  ) {
    const s = store.getState();
    const auxCount = s.auxes.length;
    this.inputNodes = s.inputs.map(
      () => new GainNode(ctx, { channelCount: 1, channelCountMode: 'explicit', channelInterpretation: 'speakers' }),
    );
    this.strips = s.channels.map(() => new ChannelStrip(ctx, auxCount));
    this.main = new Bus(ctx, 2);
    this.auxes = s.auxes.map(() => new Bus(ctx, 1));
    this.listenMix = new GainNode(ctx, { channelCount: 2, channelCountMode: 'explicit' });
    this.listenMain = new GainNode(ctx, { gain: 1 });
    this.listenAux = this.auxes.map(() => new GainNode(ctx, { gain: 0 }));
    this.limiter = new AudioWorkletNode(ctx, 'dynamics', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions: { kind: 'limiter' },
    });
    this.howlOsc = new OscillatorNode(ctx, { type: 'sine', frequency: s.howl.freq });
    this.howlGain = new GainNode(ctx, { gain: 0 });

    this.strips.forEach((st) => {
      st.mainSend.connect(this.main.input);
      st.sendsPre.forEach((g, a) => g.connect(this.auxes[a].input));
      st.sendsPost.forEach((g, a) => g.connect(this.auxes[a].input));
    });
    this.main.output.connect(this.listenMain).connect(this.listenMix);
    this.auxes.forEach((b, a) => b.output.connect(this.listenAux[a]).connect(this.listenMix));
    this.howlOsc.connect(this.howlGain);
    this.howlGain.connect(this.listenMix);
    this.listenMix.connect(this.limiter).connect(opts.destination ?? ctx.destination);
    this.howlOsc.start();

    this.wirePatch(s);
    this.applyAll(s);
    this.unsubscribe = store.subscribe((next, prev) => this.onChange(next, prev));
    if ((opts.howlTickMs ?? 50) > 0) {
      this.howlTimer = setInterval(() => this.tickHowl((opts.howlTickMs ?? 50) / 1000), opts.howlTickMs ?? 50);
    }
  }

  /** 워클릿을 올리고 스템을 디코딩한 뒤 엔진을 만든다. */
  static async create(ctx: BaseAudioContext, store: MixerStoreApi, opts: EngineOptions = {}): Promise<MixerEngine> {
    await ensureWorklets(ctx);
    const engine = new MixerEngine(ctx, store, opts);
    await engine.loadBuffers();
    return engine;
  }

  private async loadBuffers(): Promise<void> {
    if (this.opts.buffers) {
      this.buffers = new Map(this.opts.buffers);
      return;
    }
    const ids = new Set(this.store.getState().inputs.map((i) => i.stemId).filter((x): x is string => !!x));
    await Promise.all(
      [...ids].map(async (id) => {
        const stem = stemById(id);
        if (stem) this.buffers.set(id, await loadSample(this.ctx, stem.file));
      }),
    );
  }

  /** 모든 입력을 같은 시각에 루프 재생한다. */
  play(when = this.ctx.currentTime + 0.05): void {
    if (this.playing) return;
    const s = this.store.getState();
    this.sources = [];
    s.inputs.forEach((input, i) => {
      const buf = input.stemId ? this.buffers.get(input.stemId) : undefined;
      if (!buf) return;
      const src = new AudioBufferSourceNode(this.ctx, { buffer: buf, loop: true });
      src.connect(this.inputNodes[i]);
      src.start(when);
      this.sources.push(src);
    });
    this.playing = true;
  }

  stop(): void {
    for (const src of this.sources) {
      try {
        src.stop();
      } catch {
        /* 이미 멈춤 */
      }
      src.disconnect();
    }
    this.sources = [];
    this.playing = false;
  }

  dispose(): void {
    this.stop();
    this.unsubscribe();
    if (this.howlTimer) clearInterval(this.howlTimer);
    this.howlOsc.stop();
    this.strips.forEach((s) => s.disconnect());
    this.listenMix.disconnect();
    this.limiter.disconnect();
  }

  // ---- 상태 → 그래프 ----

  private applyAll(s: MixerState): void {
    s.channels.forEach((c, i) => this.strips[i]?.apply(c));
    this.main.apply(s.main);
    s.auxes.forEach((b, i) => this.auxes[i]?.apply(b));
    this.applyListen(s);
    this.applyHowlTone(s);
  }

  private onChange(next: MixerStore, prev: MixerStore): void {
    if (next.channels !== prev.channels) {
      next.channels.forEach((c, i) => {
        if (c !== prev.channels[i]) this.strips[i]?.apply(c);
      });
    }
    if (next.main !== prev.main) this.main.apply(next.main);
    if (next.auxes !== prev.auxes) next.auxes.forEach((b, i) => b !== prev.auxes[i] && this.auxes[i]?.apply(b));
    if (next.patch !== prev.patch) this.wirePatch(next);
    if (next.inputs !== prev.inputs && this.playing) {
      // 입력에 꽂힌 스템이 바뀌면 다시 재생한다.
      void this.loadBuffers().then(() => {
        this.stop();
        this.play();
      });
    }
    if (next.listen !== prev.listen) this.applyListen(next);
    if (next.howl !== prev.howl) this.applyHowlTone(next);
  }

  private wirePatch(s: MixerState): void {
    s.patch.forEach((input, ch) => {
      const old = this.patchWiring[ch];
      if (old === input) return;
      if (old !== null && old !== undefined) this.inputNodes[old]?.disconnect(this.strips[ch].input);
      if (input !== null && input !== undefined) this.inputNodes[input]?.connect(this.strips[ch].input);
    });
    this.patchWiring = s.patch.slice();
  }

  private applyListen(s: MixerState): void {
    const t = this.ctx.currentTime;
    this.listenMain.gain.setTargetAtTime(s.listen === 'main' ? 1 : 0, t, RAMP);
    this.listenAux.forEach((g, a) => g.gain.setTargetAtTime(s.listen === a ? 1 : 0, t, RAMP));
  }

  private applyHowlTone(s: MixerState): void {
    this.howlOsc.frequency.setTargetAtTime(s.howl.freq, this.ctx.currentTime, RAMP);
    const aux = this.auxes[s.howl.aux];
    this.howlGain.disconnect();
    this.howlGain.connect(this.listenMix);
    if (aux) this.howlGain.connect(aux.analyser);
    if (!s.howl.active) {
      this.howlLevelDb = HOWL_FLOOR_DB;
      this.howlGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }

  /** dt초만큼 하울링 크기를 갱신한다(타이머·테스트에서 부른다). */
  tickHowl(dt: number): void {
    const s = this.store.getState();
    if (!s.howl.active || !this.playing) {
      this.howlLevelDb = HOWL_FLOOR_DB;
      this.howlGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      return;
    }
    this.howlLevelDb = howlStep(this.howlLevelDb, howlLoopGainDb(s), dt);
    this.howlGain.gain.setTargetAtTime(dbToGain(this.howlLevelDb), this.ctx.currentTime, 0.04);
  }

  // ---- 미터 ----

  private scratch = new Float32Array(1024);
  private readPeak(a: AnalyserNode): number {
    if (this.scratch.length !== a.fftSize) this.scratch = new Float32Array(a.fftSize);
    a.getFloatTimeDomainData(this.scratch);
    return peakDb(this.scratch);
  }

  inputPeakDb(ch: number): number {
    const st = this.strips[ch];
    return st ? this.readPeak(st.inputMeter) : -Infinity;
  }

  faderPeakDb(ch: number): number {
    const st = this.strips[ch];
    return st ? this.readPeak(st.faderMeter) : -Infinity;
  }

  busPeakDb(bus: BusRef): number {
    const b = bus === 'main' ? this.main : this.auxes[bus];
    return b ? this.readPeak(b.analyser) : -Infinity;
  }

  private freqScratch = new Float32Array(4096);
  /** 버스 출력의 1/3옥타브 31밴드 크기(dB). */
  rta(bus: BusRef): number[] {
    const b = bus === 'main' ? this.main : this.auxes[bus];
    if (!b) return [];
    const a = b.analyser;
    if (this.freqScratch.length !== a.frequencyBinCount) this.freqScratch = new Float32Array(a.frequencyBinCount);
    a.getFloatFrequencyData(this.freqScratch);
    return binsToThirdOctave(this.freqScratch, this.ctx.sampleRate, a.fftSize);
  }

  gateGrDb(ch: number): number {
    return this.strips[ch]?.gateGrDb ?? 0;
  }
  gateOpen(ch: number): boolean {
    return this.strips[ch]?.gateOpen ?? false;
  }
  compGrDb(ch: number): number {
    return this.strips[ch]?.compGrDb ?? 0;
  }
}
