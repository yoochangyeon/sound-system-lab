// 레슨 위젯용 작은 믹서 상태: 채널 1개(+필요하면 Aux 1개) + 메인.
// 입력은 위젯이 고를 수 있는 스템들이고, 채널 1에 무엇을 꽂을지가 곧 '음원 선택'이다.
import { stemById } from '../../audio/stems';
import { GENERIC_PROFILE } from '../../consoles/profile';
import { createMixerStore, type MixerStoreApi } from '../../stores/mixer';
import { defaultMixerState, deepMerge, type DeepPartial, type MixerState } from '../../stores/mixer-model';

export interface WidgetStoreOptions {
  stems: string[];
  defaultStem: string;
  auxes?: number;
  initial?: DeepPartial<MixerState>;
}

export function createWidgetStore(o: WidgetStoreOptions): MixerStoreApi {
  const inputs = o.stems.map((id) => ({ label: stemById(id)?.label ?? id, stemId: id }));
  let state = defaultMixerState({ channels: 1, auxes: o.auxes ?? 0, inputs, auxNames: ['모니터'] });
  state.patch = [Math.max(0, o.stems.indexOf(o.defaultStem))];
  state = deepMerge(state, o.initial);
  return createMixerStore(state, GENERIC_PROFILE);
}
