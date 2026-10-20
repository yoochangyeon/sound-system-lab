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
  type SendTap,
  type HowlState,
  type FxState,
  type InsertState,
  type MatrixState,
  type PeqState,
  type OscState,
  type SceneSnapshot,
  type SceneState,
  type SoloMode,
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
  setSend(ch: number, aux: number, p: { levelDb?: number; tap?: SendTap }): void;
  /** 채널 2k와 2k+1을 묶는다. 켜면 2k의 설정을 2k+1에 복사하고 팬을 양쪽 끝으로 벌린다. */
  setLink(pair: number, on: boolean): void;
  setBusFader(bus: BusRef, db: number): void;
  setBusMute(bus: BusRef, mute: boolean): void;
  setGeqBand(bus: BusRef, band: number, db: number): void;
  resetGeq(bus: BusRef): void;
  /** 그룹을 메인으로 보낼지 */
  setBusMainAssign(bus: number, on: boolean): void;
  setBusPeqOn(bus: BusRef, on: boolean): void;
  setBusPeqBand(bus: BusRef, band: number, p: Partial<PeqBandState>): void;
  setBusComp(bus: BusRef, p: DynPatch<CompState>): void;
  /** fx 버스의 이펙트 설정 */
  setFx(bus: number, p: Partial<FxState>): void;
  /** FX 리턴 크기·뮤트 */
  setFxReturn(bus: number, p: { returnDb?: number; returnMute?: boolean }): void;
  /** 채널 인서트 */
  setInsert(ch: number, p: Partial<Omit<InsertState, 'fx'>> & { fx?: Partial<FxState> }): void;
  setSolo(ch: number, on: boolean): void;
  clearSolo(): void;
  setSoloMode(mode: SoloMode): void;
  setDca(i: number, p: { faderDb?: number; mute?: boolean; name?: string }): void;
  setDcaMember(i: number, ch: number, on: boolean): void;
  setMuteGroup(i: number, on: boolean): void;
  setMuteGroupMember(i: number, ch: number, on: boolean): void;
  /** 지금 상태를 씬 i에 저장한다 */
  saveScene(i: number, name?: string): void;
  /** 씬 i를 불러온다. 리콜 세이프 채널과 솔로는 그대로 둔다 */
  recallScene(i: number): void;
  setSafe(ch: number, on: boolean): void;
  /** 저장해 둔 씬 목록을 넣는다(새로고침 뒤 불러오기). 채널 수가 다른 스냅샷은 버린다. */
  setScenes(scenes: SceneState[]): void;
  setOsc(p: Partial<OscState>): void;
  setMatrix(i: number, p: { faderDb?: number; mute?: boolean; fromMainDb?: number; fromBus?: { bus: number; db: number } }): void;
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

function clampFx(f: FxState, c: Clamp): FxState {
  return {
    ...f,
    decayS: c('fxDecay', f.decayS),
    preDelayMs: c('fxPreDelay', f.preDelayMs),
    timeMs: c('fxTime', f.timeMs),
    feedbackPct: c('fxFeedback', f.feedbackPct),
    rateHz: c('fxRate', f.rateHz),
    depthPct: c('fxDepth', f.depthPct),
    hiCutHz: c('fxHiCut', f.hiCutHz),
    loCutHz: c('fxLoCut', f.loCutHz),
  };
}

function clampInsert(x: InsertState, c: Clamp): InsertState {
  return { ...x, mixPct: c('mix', x.mixPct), fx: clampFx(x.fx, c) };
}

function clampPeq(x: PeqState, c: Clamp): PeqState {
  return { ...x, bands: x.bands.map((b) => ({ ...b, freq: c('eqFreq', b.freq), gainDb: c('eqGain', b.gainDb), q: c('eqQ', b.q) })) };
}

function clampBus(b: BusState, c: Clamp): BusState {
  return {
    ...b,
    faderDb: c('fader', b.faderDb),
    geq: b.geq.map((g) => c('geqGain', g)),
    peq: clampPeq(b.peq, c),
    comp: clampComp(b.comp, c),
    fx: clampFx(b.fx, c),
    returnDb: c('fader', b.returnDb),
  };
}

function clampMatrix(m: MatrixState, c: Clamp): MatrixState {
  return {
    ...m,
    faderDb: c('fader', m.faderDb),
    fromMainDb: c('send', m.fromMainDb),
    fromBusDb: m.fromBusDb.map((d) => c('send', d)),
  };
}

/** 상태의 모든 파라미터를 프로필 범위로 자른다(예: dLive 스타일의 최소 게인). */
export function clampState(s: MixerState, profile: DeviceProfile): MixerState {
  const c = (key: Parameters<typeof clampParam>[1], v: number) => clampParam(profile, key, v);
  return {
    ...s,
    channels: s.channels.map((x) => ({
      ...x,
      preamp: {
        ...x.preamp,
        gainDb: c('gain', x.preamp.gainDb),
        hpfFreq: c('hpfFreq', x.preamp.hpfFreq),
        lpfFreq: c('lpfFreq', x.preamp.lpfFreq),
        delayMs: c('delay', x.preamp.delayMs),
      },
      gate: clampGate(x.gate, c),
      peq: clampPeq(x.peq, c),
      comp: clampComp(x.comp, c),
      insert: clampInsert(x.insert, c),
      faderDb: c('fader', x.faderDb),
      sends: x.sends.map((sd) => ({ ...sd, levelDb: c('send', sd.levelDb) })),
    })),
    main: clampBus(s.main, c),
    auxes: s.auxes.map((b) => clampBus(b, c)),
    matrix: s.matrix.map((m) => clampMatrix(m, c)),
  };
}

/** 기종 프로필과 초기 상태를 받아 저장소를 만든다. 초기 상태는 프로필 범위로 자른다. */
export function createMixerStore(initial: MixerState, profile: DeviceProfile = GENERIC_PROFILE): MixerStoreApi {
  const base = clampState(structuredClone(initial), profile);
  return createStore<MixerStore>()((set, get) => {
    const c = (key: Parameters<typeof clampParam>[1], v: number) => clampParam(get().profile, key, v);

    /** 채널 하나를 바꾼다. 링크된 짝이 있으면 같은 변경을 짝에도 건다(link: false면 이 채널만). */
    const updateChannel = (ch: number, fn: (x: ChannelState) => ChannelState, link = true) =>
      set((s) => {
        if (!s.channels[ch]) return s;
        const channels = s.channels.slice();
        channels[ch] = fn(channels[ch]);
        const mate = ch ^ 1;
        if (link && s.links[ch >> 1] && channels[mate]) channels[mate] = fn(channels[mate]);
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
            ...(p.delayMs !== undefined && { delayMs: c('delay', p.delayMs) }),
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
      setPan: (ch, pan) => updateChannel(ch, (x) => ({ ...x, pan: Math.max(-1, Math.min(1, pan)) }), false),
      setLink: (pair, on) =>
        set((s) => {
          const [l, r] = [pair * 2, pair * 2 + 1];
          if (!s.channels[r] || s.links[pair] === on) return s;
          const links = s.links.slice();
          links[pair] = on;
          if (!on) return { links };
          const channels = s.channels.slice();
          const src = channels[l];
          channels[l] = { ...src, pan: -1 };
          channels[r] = { ...structuredClone(src), name: channels[r].name, pan: 1 };
          return { links, channels };
        }),
      setMainAssign: (ch, on) => updateChannel(ch, (x) => ({ ...x, mainAssign: on })),
      setSend: (ch, aux, p) =>
        updateChannel(ch, (x) => {
          if (!x.sends[aux]) return x;
          const sends = x.sends.slice();
          sends[aux] = {
            ...sends[aux],
            ...(p.tap !== undefined && { tap: p.tap }),
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
      setBusMainAssign: (bus, on) => updateBus(bus, (x) => ({ ...x, mainAssign: on })),
      setBusPeqOn: (bus, on) => updateBus(bus, (x) => ({ ...x, peq: { ...x.peq, on } })),
      setBusPeqBand: (bus, band, p) =>
        updateBus(bus, (x) => {
          if (!x.peq.bands[band]) return x;
          const bands = x.peq.bands.slice();
          bands[band] = { ...bands[band], ...p };
          return { ...x, peq: clampPeq({ ...x.peq, bands }, c) };
        }),
      setBusComp: (bus, { key, ...p }) =>
        updateBus(bus, (x) => ({ ...x, comp: clampComp({ ...x.comp, ...p, key: { ...x.comp.key, ...key } }, c) })),
      setFx: (bus, p) => updateBus(bus, (x) => ({ ...x, fx: clampFx({ ...x.fx, ...p }, c) })),
      setFxReturn: (bus, p) =>
        updateBus(bus, (x) => ({
          ...x,
          ...(p.returnMute !== undefined && { returnMute: p.returnMute }),
          ...(p.returnDb !== undefined && { returnDb: c('fader', p.returnDb) }),
        })),
      setInsert: (ch, { fx, ...p }) =>
        updateChannel(ch, (x) => ({ ...x, insert: clampInsert({ ...x.insert, ...p, fx: { ...x.insert.fx, ...fx } }, c) })),
      setSolo: (ch, on) => updateChannel(ch, (x) => ({ ...x, solo: on }), false),
      clearSolo: () => set((s) => (s.channels.some((x) => x.solo) ? { channels: s.channels.map((x) => (x.solo ? { ...x, solo: false } : x)) } : s)),
      setSoloMode: (soloMode) => set({ soloMode }),
      setDca: (i, p) =>
        set((s) => {
          if (!s.dca[i]) return s;
          const dca = s.dca.slice();
          dca[i] = { ...dca[i], ...p, ...(p.faderDb !== undefined && { faderDb: c('fader', p.faderDb) }) };
          return { dca };
        }),
      setDcaMember: (i, ch, on) =>
        set((s) => {
          if (!s.dca[i] || ch >= s.channels.length) return s;
          const dca = s.dca.slice();
          const members = dca[i].members.slice();
          members[ch] = on;
          dca[i] = { ...dca[i], members };
          return { dca };
        }),
      setMuteGroup: (i, on) =>
        set((s) => {
          if (!s.muteGroups[i]) return s;
          const muteGroups = s.muteGroups.slice();
          muteGroups[i] = { ...muteGroups[i], on };
          return { muteGroups };
        }),
      setMuteGroupMember: (i, ch, on) =>
        set((s) => {
          if (!s.muteGroups[i] || ch >= s.channels.length) return s;
          const muteGroups = s.muteGroups.slice();
          const members = muteGroups[i].members.slice();
          members[ch] = on;
          muteGroups[i] = { ...muteGroups[i], members };
          return { muteGroups };
        }),
      saveScene: (i, name) =>
        set((s) => {
          if (!s.scenes[i]) return s;
          const snapshot: SceneSnapshot = structuredClone({
            channels: s.channels,
            main: s.main,
            auxes: s.auxes,
            matrix: s.matrix,
            dca: s.dca,
            muteGroups: s.muteGroups,
            links: s.links,
          });
          const scenes = s.scenes.slice();
          scenes[i] = { name: name ?? scenes[i].name, snapshot };
          return { scenes };
        }),
      recallScene: (i) =>
        set((s) => {
          const snap = s.scenes[i]?.snapshot;
          if (!snap) return s;
          const next = structuredClone(snap);
          next.channels = next.channels.map((x, ch) =>
            s.safes[ch] && s.channels[ch] ? s.channels[ch] : { ...x, solo: s.channels[ch]?.solo ?? false },
          );
          return clampState({ ...s, ...next }, get().profile);
        }),
      setSafe: (ch, on) =>
        set((s) => {
          if (ch >= s.safes.length) return s;
          const safes = s.safes.slice();
          safes[ch] = on;
          return { safes };
        }),
      setScenes: (scenes) =>
        set((s) => ({
          scenes: s.scenes.map((cur, i) => {
            const x = scenes[i];
            if (!x) return cur;
            const ok = x.snapshot === null || x.snapshot.channels?.length === s.channels.length;
            return ok ? { name: x.name, snapshot: x.snapshot } : cur;
          }),
        })),
      setOsc: (p) =>
        set((s) => ({
          osc: {
            ...s.osc,
            ...p,
            ...(p.freq !== undefined && { freq: c('eqFreq', p.freq) }),
            ...(p.levelDb !== undefined && { levelDb: c('fader', p.levelDb) }),
          },
        })),
      setMatrix: (i, { fromBus, ...p }) =>
        set((s) => {
          const m = s.matrix[i];
          if (!m) return s;
          const fromBusDb = m.fromBusDb.slice();
          if (fromBus && fromBus.bus < fromBusDb.length) fromBusDb[fromBus.bus] = fromBus.db;
          const matrix = s.matrix.slice();
          matrix[i] = clampMatrix({ ...m, ...p, fromBusDb }, c);
          return { matrix };
        }),
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
