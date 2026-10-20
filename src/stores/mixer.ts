// 믹서 상태 저장소. React 밖(Zustand vanilla)에 두고 엔진과 UI가 같이 구독한다.
// UI는 액션만 부르고, 엔진은 상태 변화를 Web Audio 파라미터 램프로 옮긴다.

import { createStore, type StoreApi } from 'zustand/vanilla';
import { clampParam, GENERIC_PROFILE, type DeviceProfile } from './profile';
import {
  deepMerge,
  type BusState,
  type ChannelState,
  type CompState,
  type DeepPartial,
  type GateState,
  type KeyState,
  type ListenTarget,
  type MixerState,
  type PeqBandState,
  type PreampState,
  type HowlState,
} from './mixer-model';

export type BusRef = 'main' | number;

/** 다이내믹스 액션 입력: 키는 일부만 바꿀 수 있다. */
type DynPatch<T extends { key: KeyState }> = Partial<Omit<T, 'key'>> & { key?: Partial<KeyState> };

export interface MixerActions {
  setPreamp(ch: number, p: Partial<PreampState>): void;
  setGate(ch: number, p: DynPatch<GateState>): void;
  setPeqOn(ch: number, on: boolean): void;
  setPeqBand(ch: number, band: number, p: Partial<PeqBandState>): void;
  setComp(ch: number, p: DynPatch<CompState>): void;
  setFader(ch: number, db: number): void;
  setMute(ch: number, mute: boolean): void;
  setPan(ch: number, pan: number): void;
  setMainAssign(ch: number, on: boolean): void;
  setSend(ch: number, aux: number, p: { levelDb?: number; pre?: boolean }): void;
  setBusFader(bus: BusRef, db: number): void;
  setBusMute(bus: BusRef, mute: boolean): void;
  setGeqBand(bus: BusRef, band: number, db: number): void;
  resetGeq(bus: BusRef): void;
  setPatch(ch: number, input: number | null): void;
  setListen(target: ListenTarget): void;
  setHowl(p: Partial<HowlState>): void;
  /** 기본 상태에 덮어써서 새 상태로 바꾼다(미션 시작). */
  apply(patch: DeepPartial<MixerState>): void;
  /** 저장소를 만들 때의 상태로 되돌린다. */
  reset(): void;
}

export interface MixerStore extends MixerState {
  profile: DeviceProfile;
  actions: MixerActions;
}

export type MixerStoreApi = StoreApi<MixerStore>;

type Clamp = (key: Parameters<typeof clampParam>[1], v: number) => number;

function clampKey(k: KeyState, c: Clamp): KeyState {
  return { ...k, freq: c('keyFreq', k.freq) };
}

function clampGate(g: GateState, c: Clamp): GateState {
  return {
    ...g,
    thresholdDb: c('gateThreshold', g.thresholdDb),
    rangeDb: c('gateRange', g.rangeDb),
    attackMs: c('gateAttack', g.attackMs),
    holdMs: c('gateHold', g.holdMs),
    releaseMs: c('gateRelease', g.releaseMs),
    expRatio: c('expRatio', g.expRatio),
    key: clampKey(g.key, c),
  };
}

function clampComp(x: CompState, c: Clamp): CompState {
  return {
    ...x,
    thresholdDb: c('compThreshold', x.thresholdDb),
    ratio: c('ratio', x.ratio),
    kneeDb: c('knee', x.kneeDb),
    attackMs: c('compAttack', x.attackMs),
    releaseMs: c('compRelease', x.releaseMs),
    makeupDb: c('makeup', x.makeupDb),
    mixPct: c('mix', x.mixPct),
    key: clampKey(x.key, c),
  };
}

/** 상태의 모든 파라미터를 프로필 범위로 자른다(예: dLive 스타일의 최소 게인). */
export function clampState(s: MixerState, profile: DeviceProfile): MixerState {
  const c = (key: Parameters<typeof clampParam>[1], v: number) => clampParam(profile, key, v);
  return {
    ...s,
    channels: s.channels.map((x) => ({
      ...x,
      preamp: { ...x.preamp, gainDb: c('gain', x.preamp.gainDb), hpfFreq: c('hpfFreq', x.preamp.hpfFreq), lpfFreq: c('lpfFreq', x.preamp.lpfFreq) },
      gate: clampGate(x.gate, c),
      peq: {
        ...x.peq,
        bands: x.peq.bands.map((b) => ({ ...b, freq: c('eqFreq', b.freq), gainDb: c('eqGain', b.gainDb), q: c('eqQ', b.q) })),
      },
      comp: clampComp(x.comp, c),
      faderDb: c('fader', x.faderDb),
      sends: x.sends.map((sd) => ({ ...sd, levelDb: c('send', sd.levelDb) })),
    })),
    main: { ...s.main, faderDb: c('fader', s.main.faderDb), geq: s.main.geq.map((g) => c('geqGain', g)) },
    auxes: s.auxes.map((b) => ({ ...b, faderDb: c('fader', b.faderDb), geq: b.geq.map((g) => c('geqGain', g)) })),
  };
}

/** 기종 프로필과 초기 상태를 받아 저장소를 만든다. 초기 상태는 프로필 범위로 자른다. */
export function createMixerStore(initial: MixerState, profile: DeviceProfile = GENERIC_PROFILE): MixerStoreApi {
  const base = clampState(structuredClone(initial), profile);
  return createStore<MixerStore>()((set, get) => {
    const c = (key: Parameters<typeof clampParam>[1], v: number) => clampParam(get().profile, key, v);

    const updateChannel = (ch: number, fn: (x: ChannelState) => ChannelState) =>
      set((s) => {
        if (!s.channels[ch]) return s;
        const channels = s.channels.slice();
        channels[ch] = fn(channels[ch]);
        return { channels };
      });

    const updateBus = (bus: BusRef, fn: (x: BusState) => BusState) =>
      set((s) => {
        if (bus === 'main') return { main: fn(s.main) };
        if (!s.auxes[bus]) return s;
        const auxes = s.auxes.slice();
        auxes[bus] = fn(auxes[bus]);
        return { auxes };
      });

    const actions: MixerActions = {
      setPreamp: (ch, p) =>
        updateChannel(ch, (x) => ({
          ...x,
          preamp: {
            ...x.preamp,
            ...p,
            ...(p.gainDb !== undefined && { gainDb: c('gain', p.gainDb) }),
            ...(p.hpfFreq !== undefined && { hpfFreq: c('hpfFreq', p.hpfFreq) }),
            ...(p.lpfFreq !== undefined && { lpfFreq: c('lpfFreq', p.lpfFreq) }),
          },
        })),
      setGate: (ch, { key, ...p }) =>
        updateChannel(ch, (x) => ({ ...x, gate: clampGate({ ...x.gate, ...p, key: { ...x.gate.key, ...key } }, c) })),
      setPeqOn: (ch, on) => updateChannel(ch, (x) => ({ ...x, peq: { ...x.peq, on } })),
      setPeqBand: (ch, band, p) =>
        updateChannel(ch, (x) => {
          if (!x.peq.bands[band]) return x;
          const bands = x.peq.bands.slice();
          bands[band] = {
            ...bands[band],
            ...p,
            ...(p.freq !== undefined && { freq: c('eqFreq', p.freq) }),
            ...(p.gainDb !== undefined && { gainDb: c('eqGain', p.gainDb) }),
            ...(p.q !== undefined && { q: c('eqQ', p.q) }),
          };
          return { ...x, peq: { ...x.peq, bands } };
        }),
      setComp: (ch, { key, ...p }) =>
        updateChannel(ch, (x) => ({ ...x, comp: clampComp({ ...x.comp, ...p, key: { ...x.comp.key, ...key } }, c) })),
      setFader: (ch, db) => updateChannel(ch, (x) => ({ ...x, faderDb: c('fader', db) })),
      setMute: (ch, mute) => updateChannel(ch, (x) => ({ ...x, mute })),
      setPan: (ch, pan) => updateChannel(ch, (x) => ({ ...x, pan: Math.max(-1, Math.min(1, pan)) })),
      setMainAssign: (ch, on) => updateChannel(ch, (x) => ({ ...x, mainAssign: on })),
      setSend: (ch, aux, p) =>
        updateChannel(ch, (x) => {
          if (!x.sends[aux]) return x;
          const sends = x.sends.slice();
          sends[aux] = {
            ...sends[aux],
            ...(p.pre !== undefined && { pre: p.pre }),
            ...(p.levelDb !== undefined && { levelDb: c('send', p.levelDb) }),
          };
          return { ...x, sends };
        }),
      setBusFader: (bus, db) => updateBus(bus, (x) => ({ ...x, faderDb: c('fader', db) })),
      setBusMute: (bus, mute) => updateBus(bus, (x) => ({ ...x, mute })),
      setGeqBand: (bus, band, db) =>
        updateBus(bus, (x) => {
          if (band < 0 || band >= x.geq.length) return x;
          const geq = x.geq.slice();
          geq[band] = c('geqGain', db);
          return { ...x, geq };
        }),
      resetGeq: (bus) => updateBus(bus, (x) => ({ ...x, geq: x.geq.map(() => 0) })),
      setPatch: (ch, input) =>
        set((s) => {
          if (ch < 0 || ch >= s.patch.length) return s;
          if (input !== null && (input < 0 || input >= s.inputs.length)) return s;
          const patch = s.patch.slice();
          patch[ch] = input;
          return { patch };
        }),
      setListen: (target) => set({ listen: target }),
      setHowl: (p) => set((s) => ({ howl: { ...s.howl, ...p } })),
      apply: (patch) => set(() => clampState(deepMerge(structuredClone(base), patch), get().profile)),
      reset: () => set(() => structuredClone(base)),
    };

    return { ...structuredClone(base), profile, actions };
  });
}

/** 저장소에서 상태 부분만 꺼낸다(판정 함수 입력용). */
export function snapshot(store: MixerStoreApi): MixerState {
  const { profile: _p, actions: _a, ...state } = store.getState();
  return state;
}
