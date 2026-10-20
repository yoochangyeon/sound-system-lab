// 쉬운 믹서의 기본 믹스(기획서 S05, 음원 라이브러리 #45).
// 곡을 고르면 그 곡 매니페스트의 채널 배치(8개)로 채널을 만든다. 입력에는 그 곡의 소스가 모두 있다.
import { DEFAULT_SONG, stemId, stemsFor, type Song, type StemRole } from '../audio/library';
import { defaultMixerState, type BusKind, type FxType, type MixerState } from '../stores/mixer-model';

export const CHANNEL_COUNT = 8;
export const MONITOR_NAMES = ['모니터 1 보컬', '모니터 2 밴드'];

/**
 * 쉬운 믹서의 버스 배치(4차). 앞의 두 개는 모니터라 곡 매니페스트의 sends가 그대로 들어간다.
 * 실제 콘솔(X32는 믹스 버스 16개)보다 적게 두고, 종류마다 하나둘씩만 둔다.
 */
export const BUSES: { name: string; kind: BusKind; fx?: FxType }[] = [
  { name: MONITOR_NAMES[0], kind: 'monitor' },
  { name: MONITOR_NAMES[1], kind: 'monitor' },
  { name: '그룹 1 드럼', kind: 'group' },
  { name: '그룹 2 보컬', kind: 'group' },
  { name: 'FX 1 리버브', kind: 'fx', fx: 'reverb' },
  { name: 'FX 2 딜레이', kind: 'fx', fx: 'delay' },
];
export const MATRIX_NAMES = ['로비 스피커'];
export const DCA_COUNT = 4;
export const MUTE_GROUP_COUNT = 4;
export const SCENE_COUNT = 4;

/** 버스 번호 찾기(미션·화면) */
export const busIndex = (kind: BusKind, nth = 0) => BUSES.map((b, i) => [b, i] as const).filter(([b]) => b.kind === kind)[nth]?.[1] ?? -1;

/** 기본 믹스에서 각 소스의 입력 피크가 놓일 목표(dBFS). */
const TARGET_PEAK_DB = -12;

export function mixerDefaultState(song: Song = DEFAULT_SONG): MixerState {
  const stems = stemsFor(song);
  const inputs = stems.map((st, i) => ({ label: `IN ${i + 1} ${st.label}`, stemId: st.id }));
  const s = defaultMixerState({
    channels: CHANNEL_COUNT,
    auxes: BUSES.length,
    inputs,
    auxNames: BUSES.map((b) => b.name),
    auxKinds: BUSES.map((b) => b.kind),
    auxFx: BUSES.map((b) => b.fx),
    matrixNames: MATRIX_NAMES,
    dcaCount: DCA_COUNT,
    muteGroupCount: MUTE_GROUP_COUNT,
    sceneCount: SCENE_COUNT,
  });
  // 딜레이 시간은 곡 박자(점8분)에 맞춘다.
  const delay = busIndex('fx', 1);
  if (delay >= 0) s.auxes[delay].fx.timeMs = Math.round((60000 / song.bpm) * 0.75);
  s.patch = s.channels.map((_, ch) => {
    const slot = song.mixer[ch];
    if (!slot) return null;
    const i = inputs.findIndex((x) => x.stemId === stemId(song, slot.stem));
    return i >= 0 ? i : null;
  });
  s.channels = s.channels.map((c, ch) => {
    const slot = song.mixer[ch];
    const stem = slot && stems.find((x) => x.key === slot.stem);
    if (!slot || !stem) return { ...c, name: `CH ${ch + 1}`, faderDb: -Infinity };
    return {
      ...c,
      name: stem.label,
      preamp: { ...c.preamp, gainDb: Math.round((TARGET_PEAK_DB - stem.peakDb) * 2) / 2 },
      faderDb: slot.faderDb,
      sends: c.sends.map((sd, i) => (slot.sends[i] !== undefined ? { ...sd, levelDb: slot.sends[i] } : sd)),
    };
  });
  return s;
}

/** 곡의 채널 배치에서 그 역할의 첫 채널(없으면 −1). 미션이 채널을 역할로 찾는다. */
export function channelOfRole(song: Song, role: StemRole): number {
  return song.mixer.findIndex((slot) => song.stems.find((st) => st.key === slot.stem)?.role === role);
}
