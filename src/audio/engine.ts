// 믹서 엔진: 저장소 상태를 구독해 Web Audio 그래프로 옮긴다.
// 입력(스템) → 패치 → 채널 스트립 → 버스(모니터·그룹) → 메인 → 매트릭스 → 듣기 선택 → 안전 리미터 → 출력.
// 그룹은 채널의 팬 뒤 스테레오를 받아 메인으로 보내고(mainAssign), 매트릭스는 메인과 그룹을 받는다.
// 하울링 톤은 하울링 설정이 켜졌을 때 해당 Aux의 RTA와 최종 출력에 섞인다(듣기 선택과 상관없음).
// 소스는 채널에 연결된 것만 불러온다(#45). 재생 중에 새로 연결되면 지금 루프 위치에 맞춰 이어서 튼다.
// 정답 믹스(원곡 믹스)는 따로 불러 같은 시각에 맞춰 돌리고, 듣기를 '정답 믹스'로 고를 때만 들린다.

import { Bus, MatrixBus } from './bus';
import { ChannelStrip } from './channel-strip';
import { FxUnit } from './fx/fx-unit';
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
  /** 그룹 → 메인 할당 */
  readonly busMain: GainNode[];
  /** fx 버스마다 이펙트와 리턴(크기·뮤트 → 메인 할당). fx가 아닌 버스는 null */
  readonly fxUnits: (FxUnit | null)[];
  readonly fxReturns: (GainNode | null)[];
  readonly fxReturnMeters: (AnalyserNode | null)[];
  readonly matrix: MatrixBus[];
  readonly listenMatrix: GainNode[];
  readonly inputNodes: GainNode[];
  readonly listenMain: GainNode;
  readonly listenAux: GainNode[];
  readonly listenMix: GainNode;
  readonly limiter: AudioWorkletNode;
  readonly howlOsc: OscillatorNode;
  readonly howlGain: GainNode;
  readonly refGain: GainNode;

  private buffers = new Map<string, AudioBuffer>();
  private sources = new Map<number, AudioBufferSourceNode>();
  private startedAt = 0;
  private refBuffer: AudioBuffer | null = null;
  private refSource: AudioBufferSourceNode | null = null;
  private refTrimDb = 0;
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
    const kinds = s.auxes.map((b) => b.kind);
    this.inputNodes = s.inputs.map(
      () => new GainNode(ctx, { channelCount: 1, channelCountMode: 'explicit', channelInterpretation: 'speakers' }),
    );
    this.strips = s.channels.map(() => new ChannelStrip(ctx, kinds));
    this.main = new Bus(ctx, 2);
    this.auxes = kinds.map((k) => new Bus(ctx, k === 'group' ? 2 : 1));
    this.busMain = kinds.map(() => new GainNode(ctx, { gain: 0 }));
    this.fxUnits = kinds.map((k) => (k === 'fx' ? new FxUnit(ctx) : null));
    this.fxReturns = kinds.map((k) => (k === 'fx' ? new GainNode(ctx, { gain: 0 }) : null));
    this.fxReturnMeters = kinds.map((k) => (k === 'fx' ? new AnalyserNode(ctx, { fftSize: 1024 }) : null));
    this.matrix = s.matrix.map(() => new MatrixBus(ctx, this.main.output, this.auxes.map((b) => b.output)));
    this.listenMatrix = this.matrix.map(() => new GainNode(ctx, { gain: 0 }));
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
    this.refGain = new GainNode(ctx, { channelCount: 2, channelCountMode: 'explicit', gain: 0 });

    this.strips.forEach((st) => {
      st.mainSend.connect(this.main.input);
      st.sendsPreEq.forEach((g, a) => g.connect(this.auxes[a].input));
      st.sendsPre.forEach((g, a) => g.connect(this.auxes[a].input));
      st.sendsPost.forEach((g, a) => g.connect(this.auxes[a].input));
      st.sendsGroup.forEach((g, a) => g.connect(this.auxes[a].input));
    });
    this.auxes.forEach((b, a) => {
      b.output.connect(this.busMain[a]).connect(this.main.input);
      const fx = this.fxUnits[a];
      const ret = this.fxReturns[a];
      if (fx && ret) {
        b.output.connect(fx.input);
        fx.output.connect(ret).connect(this.main.input);
        fx.output.connect(this.fxReturnMeters[a]!);
      }
    });
    this.matrix.forEach((m, i) => m.output.connect(this.listenMatrix[i]).connect(this.listenMix));
    this.main.output.connect(this.listenMain).connect(this.listenMix);
    this.auxes.forEach((b, a) => b.output.connect(this.listenAux[a]).connect(this.listenMix));
    this.howlOsc.connect(this.howlGain);
    this.howlGain.connect(this.listenMix);
    this.refGain.connect(this.listenMix);
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

  /** 채널에 연결된 입력의 스템 id들. */
  private neededIds(s: MixerState = this.store.getState()): string[] {
    const ids = new Set<string>();
    for (const input of s.patch) {
      const id = input !== null && input !== undefined ? s.inputs[input]?.stemId : null;
      if (id) ids.add(id);
    }
    return [...ids];
  }

  /** 연결된 소스만 불러온다(이미 불러온 것은 건너뛴다). */
  private async loadBuffers(): Promise<void> {
    if (this.opts.buffers) {
      if (this.buffers.size === 0) this.buffers = new Map(this.opts.buffers);
      return;
    }
    await Promise.all(
      this.neededIds()
        .filter((id) => !this.buffers.has(id))
        .map(async (id) => {
          const stem = stemById(id);
          if (stem) this.buffers.set(id, await loadSample(this.ctx, stem.file));
        }),
    );
  }

  /** 지금 루프 안에서의 위치(초). */
  private loopOffset(buf: AudioBuffer): number {
    return Math.max(0, this.ctx.currentTime - this.startedAt) % buf.duration;
  }

  private startInput(i: number, when: number, offset = 0): void {
    const s = this.store.getState();
    const id = s.inputs[i]?.stemId;
    const buf = id ? this.buffers.get(id) : undefined;
    if (!buf || this.sources.has(i)) return;
    const src = new AudioBufferSourceNode(this.ctx, { buffer: buf, loop: true });
    src.connect(this.inputNodes[i]);
    src.start(when, offset);
    this.sources.set(i, src);
  }

  private startReference(when: number, offset = 0): void {
    if (!this.refBuffer || this.refSource) return;
    const src = new AudioBufferSourceNode(this.ctx, { buffer: this.refBuffer, loop: true });
    src.connect(this.refGain);
    src.start(when, offset);
    this.refSource = src;
  }

  /** 재생 중에 새로 불러온 소스를 지금 위치에 맞춰 튼다. */
  private syncSources(): void {
    if (!this.playing) return;
    const now = this.ctx.currentTime;
    this.store.getState().inputs.forEach((input, i) => {
      const buf = input.stemId ? this.buffers.get(input.stemId) : undefined;
      if (buf && !this.sources.has(i)) this.startInput(i, now, this.loopOffset(buf));
    });
    if (this.refBuffer && !this.refSource) this.startReference(now, this.loopOffset(this.refBuffer));
  }

  /** 모든 입력을 같은 시각에 루프 재생한다. */
  play(when = this.ctx.currentTime + 0.05): void {
    if (this.playing) return;
    this.startedAt = when;
    this.store.getState().inputs.forEach((_, i) => this.startInput(i, when));
    this.startReference(when);
    this.playing = true;
  }

  stop(): void {
    const all = [...this.sources.values(), ...(this.refSource ? [this.refSource] : [])];
    for (const src of all) {
      try {
        src.stop();
      } catch {
        /* 이미 멈춤 */
      }
      src.disconnect();
    }
    this.sources.clear();
    this.refSource = null;
    this.playing = false;
  }

  /** 정답 믹스(원곡 믹스)를 정한다. trimDb만큼 줄여서 내 믹스와 크기를 비슷하게 맞춘다. */
  async setReference(file: string | null, trimDb = 0): Promise<void> {
    this.refTrimDb = trimDb;
    if (this.refSource) {
      try {
        this.refSource.stop();
      } catch {
        /* 이미 멈춤 */
      }
      this.refSource.disconnect();
      this.refSource = null;
    }
    this.refBuffer = file ? await loadSample(this.ctx, file) : null;
    this.syncSources();
    this.applyListen(this.store.getState());
  }

  dispose(): void {
    this.stop();
    this.unsubscribe();
    if (this.howlTimer) clearInterval(this.howlTimer);
    this.howlOsc.stop();
    this.strips.forEach((s) => s.disconnect());
    [this.main, ...this.auxes].forEach((b) => b.disconnect());
    this.fxUnits.forEach((f) => f?.dispose());
    this.listenMix.disconnect();
    this.limiter.disconnect();
  }

  // ---- 상태 → 그래프 ----

  private applyAll(s: MixerState): void {
    s.channels.forEach((c, i) => this.strips[i]?.apply(c, this.strips));
    this.main.apply(s.main);
    s.auxes.forEach((b, i) => this.applyBus(b, i));
    this.applyMatrix(s);
    this.applyListen(s);
    this.applyHowlTone(s);
  }

  private onChange(next: MixerStore, prev: MixerStore): void {
    if (next.channels !== prev.channels) {
      next.channels.forEach((c, i) => {
        if (c !== prev.channels[i]) this.strips[i]?.apply(c, this.strips);
      });
    }
    if (next.main !== prev.main) this.main.apply(next.main);
    if (next.auxes !== prev.auxes) next.auxes.forEach((b, i) => b !== prev.auxes[i] && this.applyBus(b, i));
    if (next.matrix !== prev.matrix) this.applyMatrix(next);
    if (next.patch !== prev.patch) {
      this.wirePatch(next);
      // 새로 연결된 소스를 불러와 지금 위치에 맞춰 튼다.
      void this.loadBuffers().then(() => this.syncSources());
    }
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

  private applyBus(b: MixerState['auxes'][number], i: number): void {
    this.auxes[i]?.apply(b);
    const t = this.ctx.currentTime;
    this.busMain[i]?.gain.setTargetAtTime(b.kind === 'group' && b.mainAssign ? 1 : 0, t, RAMP);
    this.fxUnits[i]?.apply(b.fx);
    const ret = b.returnMute || !b.mainAssign || b.returnDb === -Infinity ? 0 : dbToGain(b.returnDb);
    this.fxReturns[i]?.gain.setTargetAtTime(ret, t, RAMP);
  }

  private applyMatrix(s: MixerState): void {
    const isGroup = s.auxes.map((b) => b.kind === 'group');
    s.matrix.forEach((m, i) => this.matrix[i]?.apply(m, isGroup));
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
    this.listenMatrix.forEach((g, i) => g.gain.setTargetAtTime(s.listen === `matrix-${i}` ? 1 : 0, t, RAMP));
    this.refGain.gain.setTargetAtTime(s.listen === 'reference' && this.refBuffer ? dbToGain(this.refTrimDb) : 0, t, RAMP);
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

  matrixPeakDb(i: number): number {
    const m = this.matrix[i];
    return m ? this.readPeak(m.analyser) : -Infinity;
  }

  /** FX 리턴(이펙트 출력, 리턴 페이더 앞) 피크 */
  fxReturnPeakDb(bus: number): number {
    const m = this.fxReturnMeters[bus];
    return m ? this.readPeak(m) : -Infinity;
  }

  busCompGrDb(bus: BusRef): number {
    return (bus === 'main' ? this.main : this.auxes[bus])?.compGrDb ?? 0;
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
