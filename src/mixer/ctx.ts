// 쉬운 믹서 화면 조각들이 같이 받는 것.
import type { MixerEngine } from '../audio/engine';
import type { MixerStoreApi } from '../stores/mixer';

export type MixerView = 'basic' | 'full';

export interface Ctx {
  store: MixerStoreApi;
  engine: MixerEngine | null;
  playing: boolean;
  /** 전체 보기(4차 기능이 모두 보인다) */
  full: boolean;
  /** 곡 템포(딜레이 박자 맞추기) */
  bpm: number;
}

/** 버스 종류별 색 */
export const FX_COLOR = 'var(--fn-fx)';
export const BUS_COLOR = 'var(--fn-bus)';
export const DYN_COLOR = 'var(--fn-dyn)';
