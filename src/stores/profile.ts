// 파라미터 프로필: 범위·스텝·표시 단위. 저장소는 값을 현재 프로필 범위로 자른다.
// 위젯과 쉬운 믹서는 기본 프로필 하나를 쓴다(2차 개편에서 기종별 프로필을 뺐다).

export interface Range {
  min: number;
  max: number;
  step: number;
  unit: string;
  /** 노브·슬라이더를 로그 눈금으로 움직일지(주파수, 시간 등) */
  log?: boolean;
  /** 화면 표시 = 저장 값 + offset (예: dBFS를 dBu로 보여 줄 때 +18) */
  offset?: number;
}

export type ParamKey =
  | 'gain'
  | 'hpfFreq'
  | 'lpfFreq'
  | 'gateThreshold'
  | 'gateRange'
  | 'gateAttack'
  | 'gateHold'
  | 'gateRelease'
  | 'expRatio'
  | 'keyFreq'
  | 'mix'
  | 'compThreshold'
  | 'ratio'
  | 'knee'
  | 'compAttack'
  | 'compRelease'
  | 'makeup'
  | 'eqFreq'
  | 'eqGain'
  | 'eqQ'
  | 'fader'
  | 'send'
  | 'geqGain';

export interface DeviceProfile {
  id: string;
  name: string;
  ranges: Record<ParamKey, Range>;
}

export const GENERIC_PROFILE: DeviceProfile = {
  id: 'generic',
  name: '기본',
  ranges: {
    gain: { min: -24, max: 60, step: 0.5, unit: 'dB' },
    hpfFreq: { min: 20, max: 400, step: 1, unit: 'Hz', log: true },
    lpfFreq: { min: 1000, max: 20000, step: 10, unit: 'Hz', log: true },
    gateThreshold: { min: -80, max: 0, step: 0.5, unit: 'dB' },
    gateRange: { min: 3, max: 60, step: 1, unit: 'dB' },
    gateAttack: { min: 0, max: 120, step: 0.5, unit: 'ms' },
    gateHold: { min: 0, max: 2000, step: 1, unit: 'ms', log: true },
    gateRelease: { min: 5, max: 4000, step: 1, unit: 'ms', log: true },
    expRatio: { min: 1.5, max: 4, step: 0.5, unit: ':1' },
    keyFreq: { min: 20, max: 20000, step: 1, unit: 'Hz', log: true },
    mix: { min: 0, max: 100, step: 1, unit: '%' },
    compThreshold: { min: -60, max: 0, step: 0.5, unit: 'dB' },
    ratio: { min: 1, max: 20, step: 0.1, unit: ':1', log: true },
    knee: { min: 0, max: 10, step: 0.5, unit: 'dB' },
    compAttack: { min: 0, max: 120, step: 0.5, unit: 'ms' },
    compRelease: { min: 5, max: 4000, step: 1, unit: 'ms', log: true },
    makeup: { min: 0, max: 24, step: 0.5, unit: 'dB' },
    eqFreq: { min: 20, max: 20000, step: 1, unit: 'Hz', log: true },
    eqGain: { min: -15, max: 15, step: 0.25, unit: 'dB' },
    eqQ: { min: 0.3, max: 10, step: 0.1, unit: '', log: true },
    fader: { min: -90, max: 10, step: 0.5, unit: 'dB' },
    send: { min: -90, max: 10, step: 0.5, unit: 'dB' },
    geqGain: { min: -15, max: 15, step: 0.5, unit: 'dB' },
  },
};

/** 범위로 자른다. 페이더·센드는 min 이하를 -Infinity(완전히 내림)로 둔다. */
export function clampParam(profile: DeviceProfile, key: ParamKey, value: number): number {
  const r = profile.ranges[key];
  if ((key === 'fader' || key === 'send') && value <= r.min) return -Infinity;
  if (Number.isNaN(value)) return r.min;
  return Math.min(r.max, Math.max(r.min, value));
}
