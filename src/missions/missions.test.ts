// 경계 ①: 미션마다, 기종 프로필마다
//  - 시작 상태는 실패, 정답 조작은 성공, 함정 조작은 실패
//  - 정답 조작이 그 프로필의 파라미터 범위 안에서 가능하다(잘리지 않는다)
import { describe, expect, it } from 'vitest';
import { DLIVE_PROFILE } from '../consoles/dlive/profile';
import { consoleDefaultState } from '../consoles/shared/console-state';
import { X32_PROFILE } from '../consoles/x32/profile';
import { createMixerStore, snapshot, type MixerStoreApi } from '../stores/mixer';
import { MISSIONS } from '.';
import type { Mission } from './types';

const PROFILES = [X32_PROFILE, DLIVE_PROFILE];

function start(m: Mission, profile: typeof X32_PROFILE): { store: MixerStoreApi; startState: ReturnType<typeof snapshot> } {
  const store = createMixerStore(consoleDefaultState(), profile);
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
  it('하울링은 꺼져 있고, 설교 채널은 뮤트, 나머지 스템 채널은 메인까지 간다', () => {
    const s = consoleDefaultState();
    expect(s.howl.active).toBe(false);
    expect(s.channels[1].mute).toBe(true);
    expect(s.channels.length).toBe(16);
    expect(s.auxes.length).toBe(2);
  });
});
