// 경계 ①: 미션마다(쉬운 믹서 8채널)
//  - 시작 상태는 실패, 정답 조작은 성공, 함정 조작은 실패
//  - 정답 조작이 파라미터 범위 안에서 가능하다(잘리지 않는다)
import { describe, expect, it } from 'vitest';
import { mixerDefaultState } from '../mixer/mixer-state';
import { createMixerStore, snapshot, type MixerStoreApi } from '../stores/mixer';
import { GENERIC_PROFILE } from '../stores/profile';
import { channelReachesMain } from '../stores/derived';
import { MISSIONS } from '.';
import type { Mission } from './types';

const PROFILES = [GENERIC_PROFILE];

function start(m: Mission, profile: typeof GENERIC_PROFILE): { store: MixerStoreApi; startState: ReturnType<typeof snapshot> } {
  const store = createMixerStore(mixerDefaultState(), profile);
  store.getState().actions.apply(m.initial);
  return { store, startState: snapshot(store) };
}

describe.each(PROFILES)('미션 판정 — $name', (profile) => {
  it.each(MISSIONS)('$title: 시작 상태는 실패', (m) => {
    const { startState } = start(m, profile);
    expect(m.judge(startState, startState).passed).toBe(false);
  });

  it.each(MISSIONS)('$title: 정답 조작은 성공', (m) => {
    const { store, startState } = start(m, profile);
    m.solve(store.getState().actions, startState);
    const r = m.judge(snapshot(store), startState);
    expect(r.checks?.filter((c) => !c.ok).map((c) => c.label) ?? []).toEqual([]);
    expect(r.passed).toBe(true);
  });

  for (const m of MISSIONS) {
    for (const trap of m.traps ?? []) {
      it(`${m.title}: 함정 "${trap.label}"은 실패`, () => {
        const { store, startState } = start(m, profile);
        trap.apply(store.getState().actions, startState);
        expect(m.judge(snapshot(store), startState).passed).toBe(false);
      });
    }
  }

  it('미션 시작 상태의 값은 모두 프로필 범위 안에 있다', () => {
    for (const m of MISSIONS) {
      const { startState } = start(m, profile);
      for (const c of startState.channels) {
        expect(c.preamp.gainDb).toBeGreaterThanOrEqual(profile.ranges.gain.min);
        expect(c.preamp.gainDb).toBeLessThanOrEqual(profile.ranges.gain.max);
      }
    }
  });
});

describe('기본 믹스', () => {
  it('채널 8개·모니터 2개(+그룹·FX), 하울링은 꺼져 있고, 설교 채널만 뮤트, 나머지는 메인까지 간다', () => {
    const s = mixerDefaultState();
    expect(s.howl.active).toBe(false);
    expect(s.channels.length).toBe(8);
    expect(s.auxes.filter((b) => b.kind === 'monitor').length).toBe(2);
    expect(s.auxes.slice(0, 2).every((b) => b.kind === 'monitor')).toBe(true);
    // 그룹·FX로는 처음에 아무것도 보내지 않는다(기본 소리는 4차 전과 같다).
    s.channels.forEach((c) => c.sends.slice(2).forEach((sd) => expect(sd.levelDb).toBe(-Infinity)));
    expect(s.inputs.every((i) => i.stemId)).toBe(true);
    s.channels.forEach((c, i) => {
      expect(c.mute).toBe(c.name === '설교');
      if (c.name !== '설교') expect(channelReachesMain(s, i)).toBe(true);
    });
  });

  it('미션이 쓰는 채널은 모두 8채널 안에 있다', () => {
    for (const m of MISSIONS) {
      expect(m.focusChannel).toBeGreaterThanOrEqual(0);
      expect(m.focusChannel).toBeLessThan(8);
    }
  });
});
