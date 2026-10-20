// 쉬운 믹서의 기본 믹스(기획서 S05): 채널 8개, 모니터 2개(보컬, 밴드), 메인.
// 입력 IN 1~8에 스템이 하나씩 꽂혀 있다. 빈 입력은 없고, 끊긴 연결은 채널 입력을 '연결 안 됨'(null)으로 둔다.
import { STEMS } from '../audio/stems';
import { defaultMixerState, type MixerState } from '../stores/mixer-model';

export const CHANNEL_COUNT = 8;
export const MONITOR_NAMES = ['모니터 1 보컬', '모니터 2 밴드'];

/** 기본 믹스에서 각 스템의 입력 피크가 놓일 목표(dBFS). */
const TARGET_PEAK_DB = -12;

/** 채널 기본 설정: 페이더, 모니터 1·2로 보내는 양. 스템 id로 찾는다. */
const MIX: Record<string, { fader: number; mon1: number; mon2: number }> = {
  vocals: { fader: 0, mon1: 0, mon2: -10 },
  sermon: { fader: 0, mon1: -Infinity, mon2: -Infinity },
  drums: { fader: -4, mon1: -Infinity, mon2: -4 },
  bass: { fader: -3, mon1: -Infinity, mon2: -4 },
  'guitar-main': { fader: -6, mon1: -12, mon2: 0 },
  keys: { fader: -6, mon1: -14, mon2: -6 },
  shaker: { fader: -10, mon1: -Infinity, mon2: -Infinity },
  organ: { fader: -6, mon1: -Infinity, mon2: -10 },
};

const stemAt = (ch: number) => STEMS.find((s) => s.defaultChannel === ch);

export function mixerDefaultState(): MixerState {
  const inputs = Array.from({ length: CHANNEL_COUNT }, (_, i) => {
    const stem = stemAt(i);
    return { label: stem ? `IN ${i + 1} ${stem.label}` : `IN ${i + 1}`, stemId: stem?.id ?? null };
  });
  const s = defaultMixerState({ channels: CHANNEL_COUNT, auxes: MONITOR_NAMES.length, inputs, auxNames: MONITOR_NAMES });
  s.channels = s.channels.map((ch, i) => {
    const stem = stemAt(i);
    if (!stem) return { ...ch, name: `CH ${i + 1}`, faderDb: -Infinity };
    const m = MIX[stem.id];
    return {
      ...ch,
      name: stem.label,
      preamp: { ...ch.preamp, gainDb: Math.round((TARGET_PEAK_DB - stem.peakDb) * 2) / 2 },
      faderDb: m?.fader ?? 0,
      // 설교 채널은 찬양 중에는 꺼 둔다(설교 시간에 켠다).
      mute: stem.id === 'sermon',
      sends: [
        { levelDb: m?.mon1 ?? -Infinity, pre: true },
        { levelDb: m?.mon2 ?? -Infinity, pre: true },
      ],
    };
  });
  return s;
}
