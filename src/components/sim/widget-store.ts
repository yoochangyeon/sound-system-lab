// 레슨 위젯용 작은 믹서 상태: 채널 1개(+필요하면 Aux 1개) + 메인.
// 입력은 라이브러리의 모든 곡에서 위젯이 쓰는 역할의 소스들이다(역할 순서). 채널 1에 무엇을 꽂을지가 곧 '소스 선택'이다.
// 엔진은 연결된 소스만 불러오므로 곡이 늘어도 처음 로딩은 그대로다.
import { DEFAULT_SONG, SONGS, stemsFor, type StemRole } from '../../audio/library';
import { GENERIC_PROFILE } from '../../stores/profile';
import { createMixerStore, type MixerStoreApi } from '../../stores/mixer';
import { defaultMixerState, deepMerge, type DeepPartial, type MixerState } from '../../stores/mixer-model';

export interface WidgetStoreOptions {
  /** 이 위젯에 어울리는 소스 역할(앞에 있을수록 먼저, 첫 역할이 기본 소스) */
  roles: StemRole[];
  auxes?: number;
  initial?: DeepPartial<MixerState>;
}

export function createWidgetStore(o: WidgetStoreOptions): MixerStoreApi {
  const stems = SONGS.flatMap((song) => stemsFor(song, o.roles));
  const inputs = stems.map((s) => ({ label: s.label, stemId: s.id }));
  let state = defaultMixerState({ channels: 1, auxes: o.auxes ?? 0, inputs, auxNames: ['모니터'] });
  state.patch = [Math.max(0, stems.findIndex((s) => s.songId === DEFAULT_SONG.id))];
  state = deepMerge(state, o.initial);
  return createMixerStore(state, GENERIC_PROFILE);
}
