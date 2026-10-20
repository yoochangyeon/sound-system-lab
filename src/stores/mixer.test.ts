import { describe, expect, it } from 'vitest';
import { GENERIC_PROFILE } from './profile';
import { createMixerStore, snapshot } from './mixer';
import { defaultMixerState } from './mixer-model';
import {
  channelReachesMain,
  howlLoopGainDb,
  inputPeakDb,
  mainPathProblems,
  monitorLevelDb,
  sendPathGainDb,
} from './derived';
import { nearestGeqBand } from '../audio/dsp/geq';
import { DEFAULT_SONG, stemById, stemId } from '../audio/library';

const inputs = [
  { label: 'IN 1', stemId: stemId(DEFAULT_SONG, 'lead-vocal') },
  { label: 'IN 2', stemId: stemId(DEFAULT_SONG, 'snare') },
  { label: 'IN 3', stemId: null },
];

function makeStore() {
  return createMixerStore(defaultMixerState({ channels: 4, auxes: 2, inputs }), GENERIC_PROFILE);
}

describe('믹서 저장소', () => {
  it('범위 밖 값은 프로필 범위로 잘린다', () => {
    const st = makeStore();
    const a = st.getState().actions;
    a.setPreamp(0, { gainDb: 200, hpfFreq: 5 });
    a.setPeqBand(0, 1, { gainDb: -40, q: 100 });
    a.setComp(0, { ratio: 0.2 });
    const c = st.getState().channels[0];
    expect(c.preamp.gainDb).toBe(GENERIC_PROFILE.ranges.gain.max);
    expect(c.preamp.hpfFreq).toBe(GENERIC_PROFILE.ranges.hpfFreq.min);
    expect(c.peq.bands[1].gainDb).toBe(-15);
    expect(c.peq.bands[1].q).toBe(10);
    expect(c.comp.ratio).toBe(1);
  });

  it('페이더를 맨 아래로 내리면 -∞가 된다', () => {
    const st = makeStore();
    st.getState().actions.setFader(0, -200);
    expect(st.getState().channels[0].faderDb).toBe(-Infinity);
  });

  it('바뀐 채널만 새 객체가 된다(엔진이 바뀐 부분만 반영)', () => {
    const st = makeStore();
    const before = st.getState().channels;
    st.getState().actions.setMute(1, true);
    const after = st.getState().channels;
    expect(after[0]).toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
  });

  it('apply는 기본 상태에 덮어쓰고, reset은 처음으로 되돌린다', () => {
    const st = makeStore();
    st.getState().actions.setFader(0, -10);
    st.getState().actions.apply({ channels: { 1: { mute: true } } });
    expect(st.getState().channels[0].faderDb).toBe(0);
    expect(st.getState().channels[1].mute).toBe(true);
    st.getState().actions.reset();
    expect(st.getState().channels[1].mute).toBe(false);
  });

  it('없는 입력으로는 패치하지 않는다', () => {
    const st = makeStore();
    st.getState().actions.setPatch(0, 9);
    expect(st.getState().patch[0]).toBe(0);
    st.getState().actions.setPatch(0, null);
    expect(st.getState().patch[0]).toBeNull();
  });
});

describe('신호 경로', () => {
  it('기본 상태에서 스템이 꽂힌 채널은 메인까지 간다', () => {
    const s = snapshot(makeStore());
    expect(channelReachesMain(s, 0)).toBe(true);
    expect(channelReachesMain(s, 2)).toBe(false); // 빈 입력
    expect(mainPathProblems(s, 2)).toContain('patch-empty');
    expect(mainPathProblems(s, 3)).toContain('patch-none');
  });

  it('뮤트·메인 할당·페이더·메인 뮤트 중 하나라도 막히면 안 간다', () => {
    const st = makeStore();
    const a = st.getState().actions;
    a.setMainAssign(0, false);
    expect(channelReachesMain(snapshot(st), 0)).toBe(false);
    a.setMainAssign(0, true);
    a.setFader(0, -Infinity);
    expect(mainPathProblems(snapshot(st), 0)).toEqual(['fader-down']);
    a.setFader(0, 0);
    a.setBusMute('main', true);
    expect(channelReachesMain(snapshot(st), 0)).toBe(false);
  });

  it('입력 피크 추정 = 스템 피크 + 프리엠프 게인', () => {
    const st = makeStore();
    st.getState().actions.setPreamp(0, { gainDb: 6 });
    expect(inputPeakDb(snapshot(st), 0)).toBeCloseTo(stemById(inputs[0].stemId!)!.peakDb + 6, 9);
  });
});

describe('스테레오 링크', () => {
  it('켜면 앞 채널 설정을 뒤 채널에 복사하고 팬을 양쪽 끝으로 벌린다(이름은 그대로)', () => {
    const st = makeStore();
    const a = st.getState().actions;
    a.setPreamp(0, { hpfOn: true, hpfFreq: 120 });
    a.setLink(0, true);
    const [l, r] = st.getState().channels;
    expect(r.preamp.hpfFreq).toBe(120);
    expect(r.name).toBe('IN 2');
    expect([l.pan, r.pan]).toEqual([-1, 1]);
  });

  it('링크된 동안 한쪽 변경이 짝에도 걸리고, 팬은 따로 움직인다', () => {
    const st = makeStore();
    const a = st.getState().actions;
    a.setLink(0, true);
    a.setFader(1, -7);
    a.setComp(0, { on: true, ratio: 5 });
    a.setPan(0, -0.5);
    const [l, r] = st.getState().channels;
    expect([l.faderDb, r.faderDb]).toEqual([-7, -7]);
    expect(r.comp.ratio).toBe(5);
    expect([l.pan, r.pan]).toEqual([-0.5, 1]);
  });

  it('풀면 다시 따로 움직이고, 다른 짝은 영향이 없다', () => {
    const st = makeStore();
    const a = st.getState().actions;
    a.setLink(0, true);
    a.setLink(0, false);
    a.setFader(0, -3);
    a.setFader(2, -9);
    const ch = st.getState().channels;
    expect([ch[0].faderDb, ch[1].faderDb, ch[2].faderDb, ch[3].faderDb]).toEqual([-3, 0, -9, 0]);
  });

  it('채널 딜레이는 범위로 잘린다', () => {
    const st = makeStore();
    st.getState().actions.setPreamp(0, { delayOn: true, delayMs: 900 });
    expect(st.getState().channels[0].preamp.delayMs).toBe(500);
  });
});

describe('센드 경로와 하울링', () => {
  it('post 센드는 채널 페이더를 더하고, pre는 더하지 않는다', () => {
    const st = makeStore();
    const a = st.getState().actions;
    a.setPreamp(0, { gainDb: 10 });
    a.setSend(0, 0, { levelDb: -5, tap: 'pre' });
    a.setFader(0, -8);
    a.setBusFader(0, -2);
    expect(sendPathGainDb(snapshot(st), 0, 0)).toBeCloseTo(10 - 5 - 2, 9);
    a.setSend(0, 0, { tap: 'post' });
    expect(sendPathGainDb(snapshot(st), 0, 0)).toBeCloseTo(10 - 5 - 2 - 8, 9);
  });

  it('EQ 앞(pre-eq) 센드의 하울링 루프에는 PEQ가 들어가지 않는다', () => {
    const st = makeStore();
    const a = st.getState().actions;
    a.setSend(0, 0, { levelDb: 0 });
    a.setHowl({ active: true, channel: 0, aux: 0, freq: 1000 });
    a.setPeqBand(0, 1, { freq: 1000, gainDb: -12, q: 2 });
    const cut = howlLoopGainDb(snapshot(st));
    a.setSend(0, 0, { tap: 'pre-eq' });
    expect(howlLoopGainDb(snapshot(st)) - cut).toBeCloseTo(12, 0);
  });

  it('뮤트, 센드 맨 아래, Aux 뮤트면 -∞', () => {
    const st = makeStore();
    const a = st.getState().actions;
    a.setSend(0, 0, { levelDb: 0 });
    a.setMute(0, true);
    expect(sendPathGainDb(snapshot(st), 0, 0)).toBe(-Infinity);
    a.setMute(0, false);
    a.setBusMute(0, true);
    expect(sendPathGainDb(snapshot(st), 0, 0)).toBe(-Infinity);
  });

  it('하울링 대역만 깎으면 루프 게인은 크게 내려가고 모니터 레벨은 거의 그대로다', () => {
    const st = makeStore();
    const a = st.getState().actions;
    a.setSend(0, 0, { levelDb: 0 });
    a.setHowl({ active: true, channel: 0, aux: 0, freq: 2500 });
    const before = snapshot(st);
    a.setGeqBand(0, nearestGeqBand(2500), -12);
    const after = snapshot(st);
    expect(howlLoopGainDb(before)).toBeGreaterThan(0);
    expect(howlLoopGainDb(after)).toBeLessThan(0);
    expect(monitorLevelDb(before, 0, 0) - monitorLevelDb(after, 0, 0)).toBeLessThan(1.5);
  });

  it('GEQ를 통째로 내리면 모니터 레벨이 크게 내려간다', () => {
    const st = makeStore();
    const a = st.getState().actions;
    a.setSend(0, 0, { levelDb: 0 });
    const before = monitorLevelDb(snapshot(st), 0, 0);
    for (let i = 0; i < 31; i++) a.setGeqBand(0, i, -12);
    expect(before - monitorLevelDb(snapshot(st), 0, 0)).toBeGreaterThan(10);
  });
});

describe('좁은 프로필', () => {
  it('저장소를 만들 때와 미션 상태를 적용할 때 프로필 범위로 자른다', () => {
    const r = GENERIC_PROFILE.ranges;
    const NARROW = {
      id: 'narrow',
      name: '좁은 범위',
      ranges: {
        ...r,
        gain: { ...r.gain, min: -15 },
        hpfFreq: { ...r.hpfFreq, max: 2000 },
        geqGain: { ...r.geqGain, min: -12, max: 12 },
      },
    };
    const st = createMixerStore(defaultMixerState({ channels: 2, auxes: 1, inputs }), NARROW);
    st.getState().actions.apply({ channels: { 0: { preamp: { gainDb: -30, hpfFreq: 3000 } } }, auxes: { 0: { geq: { 3: -15 } } } });
    const s = st.getState();
    expect(s.channels[0].preamp.gainDb).toBe(-15);
    expect(s.channels[0].preamp.hpfFreq).toBe(2000);
    expect(s.auxes[0].geq[3]).toBe(-12);
    st.getState().actions.setComp(0, { thresholdDb: 10 });
    expect(st.getState().channels[0].comp.thresholdDb).toBe(0);
  });
});

describe('그룹과 매트릭스', () => {
  function groupStore() {
    return createMixerStore(
      defaultMixerState({ channels: 2, auxes: 2, inputs, auxKinds: ['monitor', 'group'], matrixNames: ['로비'] }),
      GENERIC_PROFILE,
    );
  }

  it('메인 할당을 꺼도 그룹을 거쳐 메인에 닿는다', () => {
    const st = groupStore();
    const a = st.getState().actions;
    a.setMainAssign(0, false);
    expect(channelReachesMain(snapshot(st), 0)).toBe(false);
    a.setSend(0, 1, { levelDb: 0 });
    expect(channelReachesMain(snapshot(st), 0)).toBe(true);
    a.setBusMainAssign(1, false);
    expect(channelReachesMain(snapshot(st), 0)).toBe(false);
    expect(mainPathProblems(snapshot(st), 0)).toContain('main-assign-off');
  });

  it('모니터 버스로 보내는 것은 메인 경로가 아니다', () => {
    const st = groupStore();
    const a = st.getState().actions;
    a.setMainAssign(0, false);
    a.setSend(0, 0, { levelDb: 0 });
    expect(channelReachesMain(snapshot(st), 0)).toBe(false);
  });

  it('매트릭스 센드는 범위로 잘리고 맨 아래면 −∞', () => {
    const st = groupStore();
    const a = st.getState().actions;
    a.setMatrix(0, { fromBus: { bus: 1, db: 30 }, fromMainDb: -200 });
    const m = st.getState().matrix[0];
    expect(m.fromBusDb[1]).toBe(10);
    expect(m.fromMainDb).toBe(-Infinity);
  });

  it('버스 컴프·PEQ도 범위로 잘린다', () => {
    const st = groupStore();
    const a = st.getState().actions;
    a.setBusComp('main', { on: true, ratio: 500 });
    a.setBusPeqBand(1, 0, { gainDb: 40 });
    expect(st.getState().main.comp.ratio).toBe(20);
    expect(st.getState().auxes[1].peq.bands[0].gainDb).toBe(15);
  });
});
