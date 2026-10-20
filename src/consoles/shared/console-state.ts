// 콘솔 실습실의 기본 믹스: 채널 16개, Aux 2개(보컬 모니터, 밴드 모니터).
// 무대 박스 단자 IN 1~12에 스템이 꽂혀 있고 IN 13~16은 비어 있다.
import { STEMS } from '../../audio/stems';
import { defaultMixerState, type MixerState } from '../../stores/mixer-model';

export const CHANNEL_COUNT = 16;
export const INPUT_COUNT = 16;
export const AUX_NAMES = ['Aux 1 보컬 모니터', 'Aux 2 밴드 모니터'];

/** 기본 믹스에서 각 스템의 입력 피크가 놓일 목표(dBFS). */
const TARGET_PEAK_DB = -12;

/** 채널 기본 설정: 채널 이름, 페이더, 팬, Aux 센드. 스템 id로 찾는다. */
const MIX: Record<string, { fader: number; pan: number; aux1: number; aux2: number }> = {
  vocals: { fader: 0, pan: 0, aux1: 0, aux2: -10 },
  sermon: { fader: 0, pan: 0, aux1: -Infinity, aux2: -Infinity },
  drums: { fader: -4, pan: 0, aux1: -Infinity, aux2: -4 },
  percussion: { fader: -10, pan: 0.3, aux1: -Infinity, aux2: -12 },
  shaker: { fader: -10, pan: -0.4, aux1: -Infinity, aux2: -Infinity },
  bass: { fader: -3, pan: 0, aux1: -Infinity, aux2: -4 },
  'guitar-main': { fader: -6, pan: -0.3, aux1: -12, aux2: 0 },
  'guitar-verse': { fader: -6, pan: 0.3, aux1: -Infinity, aux2: -6 },
  'guitar-plucks': { fader: -8, pan: 0.5, aux1: -Infinity, aux2: -8 },
  'sax-guitar': { fader: -6, pan: -0.2, aux1: -Infinity, aux2: -8 },
  organ: { fader: -6, pan: 0.4, aux1: -Infinity, aux2: -10 },
  keys: { fader: -6, pan: -0.5, aux1: -14, aux2: -6 },
};

export function consoleDefaultState(): MixerState {
  const inputs = Array.from({ length: INPUT_COUNT }, (_, i) => {
    const stem = STEMS.find((s) => s.defaultChannel === i);
    return { label: `IN ${i + 1}`, stemId: stem?.id ?? null };
  });
  const s = defaultMixerState({ channels: CHANNEL_COUNT, auxes: AUX_NAMES.length, inputs, auxNames: AUX_NAMES });
  s.channels = s.channels.map((ch, i) => {
    const stem = STEMS.find((x) => x.defaultChannel === i);
    if (!stem) return { ...ch, name: `CH ${i + 1}`, faderDb: -Infinity };
    const m = MIX[stem.id];
    return {
      ...ch,
      name: stem.label,
      preamp: { ...ch.preamp, gainDb: Math.round((TARGET_PEAK_DB - stem.peakDb) * 2) / 2 },
      faderDb: m?.fader ?? 0,
      pan: m?.pan ?? 0,
      // 설교 채널은 찬양 중에는 꺼 둔다(설교 시간에 켠다).
      mute: stem.id === 'sermon',
      sends: [
        { levelDb: m?.aux1 ?? -Infinity, pre: true },
        { levelDb: m?.aux2 ?? -Infinity, pre: true },
      ],
    };
  });
  return s;
}

export function channelIndexOfStem(id: string): number {
  return STEMS.find((s) => s.id === id)?.defaultChannel ?? -1;
}
