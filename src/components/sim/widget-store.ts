// 레슨 위젯용 작은 믹서 상태: 채널 1개(+필요하면 Aux 1개) + 메인.
// 입력은 라이브러리의 모든 곡에서 위젯이 쓰는 역할의 소스들이다(역할 순서). 채널 1에 무엇을 꽂을지가 곧 '소스 선택'이다.
// 엔진은 연결된 소스만 불러오므로 곡이 늘어도 처음 로딩은 그대로다.
import { DEFAULT_SONG, SONGS, stemsFor, type StemRole } from '../../audio/library';
import { GENERIC_PROFILE } from '../../stores/profile';
import { createMixerStore, type MixerStoreApi } from '../../stores/mixer';
import { defaultMixerState, deepMerge, type BusKind, type DeepPartial, type FxType, type MixerState } from '../../stores/mixer-model';

export interface WidgetStoreOptions {
  /** 이 위젯에 어울리는 소스 역할(앞에 있을수록 먼저, 첫 역할이 기본 소스) */
  roles: StemRole[];
  auxes?: number;
  /** 버스 종류를 정할 때(4차 위젯: FX 버스 등). 주면 auxes 대신 쓴다 */
  buses?: { name: string; kind: BusKind; fx?: FxType }[];
  /** 채널 수(기본 1). 채널 2부터는 patchRoles의 역할 소스를 꽂는다 */
  channels?: number;
  /** 채널 2, 3…에 꽂을 역할(위젯의 소스 고르기는 채널 1만 바꾼다) */
  patchRoles?: StemRole[];
  initial?: DeepPartial<MixerState>;
}

export function createWidgetStore(o: WidgetStoreOptions): MixerStoreApi {
  const stems = SONGS.flatMap((song) => stemsFor(song, o.roles));
  const inputs = stems.map((s) => ({ label: s.label, stemId: s.id }));
  const channels = o.channels ?? 1;
  let state = defaultMixerState({
    channels,
    auxes: o.buses?.length ?? o.auxes ?? 0,
    inputs,
    auxNames: o.buses?.map((b) => b.name) ?? ['모니터'],
    auxKinds: o.buses?.map((b) => b.kind),
    auxFx: o.buses?.map((b) => b.fx),
  });
  const first = (pred: (s: (typeof stems)[number]) => boolean) => stems.findIndex((s) => s.songId === DEFAULT_SONG.id && pred(s));
  state.patch = Array.from({ length: channels }, (_, ch) => {
    if (ch === 0) return Math.max(0, first(() => true));
    const role = o.patchRoles?.[ch - 1];
    const i = role ? first((s) => s.role === role) : -1;
    return i >= 0 ? i : null;
  });
  state = deepMerge(state, o.initial);
  return createMixerStore(state, GENERIC_PROFILE);
}
