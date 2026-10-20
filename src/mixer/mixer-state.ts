// 쉬운 믹서의 기본 믹스(기획서 S05, 음원 라이브러리 #45).
// 곡을 고르면 그 곡 매니페스트의 채널 배치(8개)로 채널을 만든다. 입력에는 그 곡의 소스가 모두 있다.
import { DEFAULT_SONG, stemId, stemsFor, type Song, type StemRole } from '../audio/library';
import { defaultMixerState, type MixerState } from '../stores/mixer-model';

export const CHANNEL_COUNT = 8;
export const MONITOR_NAMES = ['모니터 1 보컬', '모니터 2 밴드'];

/** 기본 믹스에서 각 소스의 입력 피크가 놓일 목표(dBFS). */
const TARGET_PEAK_DB = -12;

export function mixerDefaultState(song: Song = DEFAULT_SONG): MixerState {
  const stems = stemsFor(song);
  const inputs = stems.map((st, i) => ({ label: `IN ${i + 1} ${st.label}`, stemId: st.id }));
  const s = defaultMixerState({ channels: CHANNEL_COUNT, auxes: MONITOR_NAMES.length, inputs, auxNames: MONITOR_NAMES });
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
      sends: slot.sends.map((levelDb) => ({ levelDb, tap: 'pre' as const })),
    };
  });
  return s;
}

/** 곡의 채널 배치에서 그 역할의 첫 채널(없으면 −1). 미션이 채널을 역할로 찾는다. */
export function channelOfRole(song: Song, role: StemRole): number {
  return song.mixer.findIndex((slot) => song.stems.find((st) => st.key === slot.stem)?.role === role);
}
