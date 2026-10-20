// 쉬운 믹서 미션 4종(기획서 8장). 판정 수치의 근거는 각 해설에 적는다.
// 채널은 역할로 찾는다(#45): 곡을 바꿔도 같은 미션을 쓰고, 필요한 역할이 없는 곡에서는 그 미션을 뺀다.
import { nearestGeqBand } from '../audio/dsp/geq';
import { DEFAULT_SONG, stemsFor, type Song, type StemRole } from '../audio/library';
import { channelOfRole } from '../mixer/mixer-state';
import {
  bandAverageDb,
  channelReachesMain,
  compGrEstimateDb,
  howlLoopGainDb,
  inputPeakDb,
  monitorLevelDb,
} from '../stores/derived';
import type { MixerState } from '../stores/mixer-model';
import type { Mission } from './types';

const inputOf = (s: MixerState, id: string) => s.inputs.findIndex((i) => i.stemId === id);
const inRange = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
const db = (v: number) => (Number.isFinite(v) ? `${v > 0 ? '+' : ''}${v.toFixed(1)}` : '−∞');

/** 곡에 맞춰 미션을 만든다. */
export function buildMissions(song: Song = DEFAULT_SONG): Mission[] {
const ch = (role: StemRole) => channelOfRole(song, role);
const stemOf = (role: StemRole) => stemsFor(song, [role])[0];
const inputNo = (id: string) => stemsFor(song).findIndex((x) => x.id === id) + 1;

// ---------------- 하울링 잡기 ----------------
const VOCAL = ch('lead-vocal');
const HOWL_FREQ = 2500;
/** 모니터 레벨이 시작보다 이만큼 넘게 줄면 '소리를 줄여서 해결'로 본다. */
const MONITOR_DROP_LIMIT_DB = 3;

const howl: Mission = {
  id: 'howl',
  title: '하울링 잡기',
  situation:
    '찬양 중 인도자가 모니터를 더 크게 해 달라고 해서 보컬을 모니터 1로 더 보냈다. 그러자 인도자 발밑 모니터(모니터 1 보컬)에서 "삐—" 소리가 점점 커진다. 인도자는 모니터 소리가 줄면 안 된다고 한다. 지금 듣기는 모니터 1로 맞춰 두었다.',
  focusChannel: VOCAL,
  initial: {
    listen: 0,
    howl: { active: true, channel: VOCAL, aux: 0, freq: HOWL_FREQ },
    // 인도자가 더 크게 해 달라고 해서 모니터 1로 보내는 양을 +6 dB까지 올려 둔 상태
    channels: { [VOCAL]: { sends: { 0: { levelDb: 6 } } } },
  },
  judge: (s, start) => {
    const loop = howlLoopGainDb(s);
    const mon = monitorLevelDb(s, VOCAL, 0);
    const ref = monitorLevelDb(start, VOCAL, 0);
    const stopped = loop < 0;
    const kept = mon >= ref - MONITOR_DROP_LIMIT_DB;
    return {
      passed: stopped && kept,
      checks: [
        { label: '하울링이 멈췄다', ok: stopped },
        { label: `보컬 모니터 크기 유지(시작 대비 ${db(mon - ref)} dB, −${MONITOR_DROP_LIMIT_DB} dB까지 허용)`, ok: kept },
      ],
    };
  },
  hints: [
    '하울링은 주파수 하나에서 먼저 터진다. 어느 주파수인지부터 찾자. 아래 출력 카드에서 모니터 1을 보자.',
    '모니터 1의 \'GEQ·RTA 열기\'를 누른다. RTA에서 빨갛게 튀어나온 막대가 하울링 주파수다. 모니터 크기는 그대로 두고 그 대역만 줄여야 한다.',
    '모니터 1 GEQ에서 2.5 kHz 밴드를 −10 dB쯤 내린다. 보내는 양이나 모니터 페이더를 내리면 인도자가 자기 소리를 못 듣는다.',
  ],
  explanation:
    '하울링은 마이크 → 모니터 → 다시 마이크로 도는 소리가 한 바퀴 돌 때마다 커지는 주파수에서 생긴다(이 실습에서는 2.5 kHz). 그 주파수의 루프 게인이 0 dB 아래로 내려가야 멈춘다. GEQ에서 그 밴드 하나만 깎으면 하울링은 멈추고, 보컬 대역(200 Hz~5 kHz) 전체의 크기는 거의 그대로다. 보내는 양이나 모니터 페이더를 내리거나 GEQ를 통째로 내려도 하울링은 멈추지만, 모니터 소리가 함께 작아져서 인도자는 다시 볼륨을 올려 달라고 하고 하울링은 돌아온다. 그래서 이 미션은 모니터 크기가 시작보다 3 dB 넘게 줄면 성공으로 치지 않는다.',
  solve: (a) => a.setGeqBand(0, nearestGeqBand(HOWL_FREQ), -10),
  traps: [
    { label: '센드 내리기', apply: (a) => a.setSend(VOCAL, 0, { levelDb: -9 }) },
    { label: '모니터 페이더 내리기', apply: (a) => a.setBusFader(0, -9) },
    { label: '채널 뮤트', apply: (a) => a.setMute(VOCAL, true) },
    {
      label: 'post 센드로 바꾸고 채널 페이더 내리기',
      apply: (a) => {
        a.setSend(VOCAL, 0, { tap: 'post' });
        a.setFader(VOCAL, -10);
      },
    },
    {
      label: 'GEQ 통째로 내리기',
      apply: (a) => {
        for (let i = 0; i < 31; i++) a.setGeqBand(0, i, -10);
      },
    },
  ],
};

// ---------------- 설교 또렷하게 ----------------
// 설교 채널은 리드 보컬 음원으로 대신한다(사용자 결정, 2026-10-20).
const SERMON = ch('lead-vocal');
const BAND_CHANNELS = song.mixer.map((_, i) => i).filter((i) => i !== SERMON);
const HPF_RANGE: [number, number] = [70, 180];
const LOWMID: [number, number] = [200, 500];
const LOWMID_CUT_RANGE: [number, number] = [-8, -1];
const RATIO_RANGE: [number, number] = [2, 6];
const GR_RANGE: [number, number] = [-10, -2];

const sermon: Mission = {
  id: 'sermon',
  title: '설교 또렷하게',
  situation:
    '설교가 시작됐다. 목사님 목소리가 웅웅거리고 답답하며, 크게 말할 때와 작게 말할 때 차이가 커서 뒷자리에서 잘 안 들린다고 한다. 이 실습에서는 리드 보컬 채널이 설교 마이크를 대신한다. 다른 채널은 꺼 두었다.',
  focusChannel: SERMON,
  initial: {
    channels: {
      ...Object.fromEntries(BAND_CHANNELS.map((c) => [c, { mute: true }])),
      [SERMON]: {
        mute: false,
        faderDb: 0,
        preamp: { hpfOn: false, hpfFreq: 40 },
        peq: {
          on: true,
          bands: {
            0: { type: 'lowshelf', freq: 200, gainDb: 6, q: 0.7 },
            1: { type: 'peaking', freq: 320, gainDb: 4, q: 1.2 },
          },
        },
        comp: { on: false },
      },
    },
  },
  judge: (s) => {
    const c = s.channels[SERMON];
    const hpfOk = c.preamp.hpfOn && inRange(c.preamp.hpfFreq, ...HPF_RANGE);
    const lowmid = bandAverageDb(c, ...LOWMID);
    const lowmidOk = inRange(lowmid, ...LOWMID_CUT_RANGE);
    const ratioOk = c.comp.on && inRange(c.comp.ratio, ...RATIO_RANGE);
    const gr = compGrEstimateDb(s, SERMON);
    const grOk = c.comp.on && inRange(gr, ...GR_RANGE);
    return {
      passed: hpfOk && lowmidOk && ratioOk && grOk && !c.mute,
      checks: [
        { label: `HPF 켜고 ${HPF_RANGE[0]}~${HPF_RANGE[1]} Hz`, ok: hpfOk },
        { label: `200~500 Hz 평균 ${db(lowmid)} dB (−8~−1 dB가 목표)`, ok: lowmidOk },
        { label: `컴프 레이시오 2:1~6:1`, ok: ratioOk },
        { label: `컴프가 평소 말소리를 ${db(gr)} dB 누름(−2~−10 dB가 목표)`, ok: grOk },
      ],
    };
  },
  hints: [
    '웅웅거림은 낮은 소리가 너무 많다는 뜻이고, 크기 차이는 컴프레서로 줄인다. 리드 보컬 채널(설교 마이크 대신) 이름을 눌러 채널 상세를 열자.',
    'EQ 탭에서 먼저 HPF로 말소리에 필요 없는 저음을 자른다(100 Hz 안팎). 그다음 PEQ에서 200~500 Hz를 조금 내린다. 지금 저음·중저음 밴드가 이 대역을 올려 둔 상태다.',
    'HPF 켜고 110 Hz, 저음 밴드 0 dB, 중저음 밴드(320 Hz) −3 dB 정도. 컴프 탭에서 켜고 레이시오 3:1, 스레숄드를 −30 dB 근처로 내려 GR이 3~6 dB 움직이게 한다.',
  ],
  explanation:
    '말소리의 기본음은 대체로 100 Hz 위에 있어서, HPF로 그 아래를 자르면 마이크가 줍는 울림과 쿵 소리만 줄고 말은 그대로 남는다. 200~500 Hz는 입 가까이 댄 마이크(근접 효과)나 강단 울림으로 쉽게 부풀어 "웅웅"하게 들리는 대역이라 조금만 내려도 또렷해진다. 너무 많이(8 dB 넘게) 깎으면 목소리가 얇아진다. 컴프레서는 큰 소리만 2~10 dB 눌러 작은 소리와의 차이를 줄인다. 레이시오는 말소리에 2:1~6:1이 무난하고, 그보다 세게 누르면 숨소리와 잡음까지 커진다.',
  solve: (a, s) => {
    a.setPreamp(SERMON, { hpfOn: true, hpfFreq: 110 });
    a.setPeqBand(SERMON, 0, { gainDb: 0 });
    a.setPeqBand(SERMON, 1, { gainDb: -3 });
    const st = stemOf('lead-vocal');
    const rms = inputPeakDb(s, SERMON) - (st.peakDb - st.rmsDb);
    // 정적 GR이 약 −4 dB가 되도록: (1 − 1/3)(rms − thr) = 4
    a.setComp(SERMON, { on: true, ratio: 3, kneeDb: 0, thresholdDb: Math.round(rms - 6) });
  },
  traps: [
    {
      label: '저중역을 너무 깊게 깎기',
      apply: (a) => {
        a.setPreamp(SERMON, { hpfOn: true, hpfFreq: 110 });
        a.setPeqBand(SERMON, 0, { gainDb: -12 });
        a.setPeqBand(SERMON, 1, { gainDb: -15 });
        a.setComp(SERMON, { on: true, ratio: 3, thresholdDb: -30 });
      },
    },
    {
      label: '컴프로 세게 누르기',
      apply: (a) => {
        a.setPreamp(SERMON, { hpfOn: true, hpfFreq: 110 });
        a.setPeqBand(SERMON, 0, { gainDb: 0 });
        a.setPeqBand(SERMON, 1, { gainDb: -3 });
        a.setComp(SERMON, { on: true, ratio: 20, thresholdDb: -55 });
      },
    },
  ],
};

// ---------------- 게인 맞추기 ----------------
const LOUD = (['snare', 'guitar'] as StemRole[]).map(ch);
const QUIET = (['backing-vocal', 'bass'] as StemRole[]).map(ch);
const GAIN_TARGETS = [...LOUD, ...QUIET];
const PEAK_RANGE: [number, number] = [-18, -6];
/** 너무 작게 잡아 둔 채널의 게인(dB). 피크가 목표보다 한참 아래로 간다. */
const QUIET_GAIN_DB = -24;
const peakOf = (c: number) => stemsFor(song).find((x) => x.key === song.mixer[c].stem)!.peakDb;
const nameOf = (c: number) => stemsFor(song).find((x) => x.key === song.mixer[c].stem)!.label;

const gain: Mission = {
  id: 'gain',
  title: '게인 맞추기',
  situation: `리허설에서 다른 봉사자가 게인을 대충 잡아 두었다. ${LOUD.map(nameOf).join('와 ')}는 미터 꼭대기가 빨갛게 켜지고, ${QUIET.map(nameOf).join('과 ')}는 페이더를 올려도 거의 안 들린다.`,
  focusChannel: LOUD[0],
  initial: {
    channels: Object.fromEntries([
      // 너무 큰 채널: 피크가 +4 dBFS(클리핑)
      ...LOUD.map((c) => [c, { preamp: { gainDb: Math.round(4 - peakOf(c)) } }]),
      ...QUIET.map((c) => [c, { preamp: { gainDb: QUIET_GAIN_DB } }]),
    ]),
  },
  judge: (s) => {
    const checks = GAIN_TARGETS.map((c) => {
      const p = inputPeakDb(s, c);
      return { label: `${s.channels[c].name}: 입력 피크 ${db(p)} dBFS (−18~−6 목표)`, ok: inRange(p, ...PEAK_RANGE) };
    });
    return { passed: checks.every((x) => x.ok), checks };
  },
  hints: [
    '페이더는 이미 깨진 소리를 되살리지 못한다. 소리 크기를 처음 잡는 곳은 프리엠프다.',
    '채널 이름을 하나씩 눌러 입력 탭을 연다. 입력 미터를 보며 게인을 맞춘다. 빨간 칸이 켜지지 않고, 큰 소리에서 미터가 노란색 아래에 머물면 된다.',
    `목표는 입력 피크 −18~−6 dBFS다. ${LOUD.map(nameOf).join('·')}는 게인을 15 dB 안팎 내리고, ${QUIET.map(nameOf).join('·')}는 15 dB 넘게 올린다.`,
  ],
  explanation:
    '디지털 콘솔은 0 dBFS를 넘는 순간 파형 꼭대기가 잘린다. 잘린 소리는 뒤에서 페이더를 내려도 깨진 채로 작아질 뿐이다. 반대로 게인이 너무 작으면 페이더를 많이 올려야 하고, 그만큼 잡음도 함께 커진다. 그래서 입력 피크가 0 dBFS보다 6~18 dB 아래(헤드룸)에 오도록 프리엠프에서 먼저 맞추고, 크기 균형은 그다음에 페이더로 잡는다.',
  solve: (a) => {
    for (const c of GAIN_TARGETS) a.setPreamp(c, { gainDb: Math.round(-12 - peakOf(c)) });
  },
  traps: [
    {
      label: '페이더만 움직이기',
      apply: (a) => {
        for (const c of LOUD) a.setFader(c, -15);
        for (const c of QUIET) a.setFader(c, 10);
      },
    },
  ],
};

// ---------------- 소리 안 나는 채널 ----------------
const GUITAR = ch('guitar');
const G_STEM = stemOf('guitar');

const noSound: Mission = {
  id: 'no-sound',
  title: '소리 안 나는 채널',
  situation:
    '예배 시작 5분 전, 일렉 기타 연주자가 "제 소리가 하나도 안 나와요"라고 한다. 앰프 쪽은 이상이 없다. 믹서 어딘가에서 신호가 끊겼다.',
  focusChannel: GUITAR,
  initial: {
    patch: { [GUITAR]: null },
    channels: { [GUITAR]: { mute: true, mainAssign: false } },
  },
  judge: (s) => {
    const want = inputOf(s, G_STEM.id);
    const c = s.channels[GUITAR];
    const checks = [
      { label: `입력: ${s.channels[GUITAR].name} 채널에 IN ${want + 1}(${G_STEM.label})이 연결되어 있다`, ok: s.patch[GUITAR] === want },
      { label: '뮤트가 풀려 있다', ok: !c.mute },
      { label: '메인 보내기가 켜져 있다', ok: c.mainAssign },
      { label: '페이더와 메인이 열려 있다', ok: c.faderDb !== -Infinity && !s.main.mute && s.main.faderDb !== -Infinity },
    ];
    return { passed: checks.every((x) => x.ok) && channelReachesMain(s, GUITAR), checks };
  },
  hints: [
    '소리는 입력(무대 박스) → 채널 → 페이더 → 메인 순서로 흐른다. 앞에서부터 하나씩 따라가 보자.',
    '일렉 기타 채널 이름을 눌러 입력 탭에서 어떤 입력이 연결되어 있는지 본다. 그다음 채널 줄의 끄기(뮤트)와 메인 버튼을 본다.',
    `입력 탭에서 IN ${inputNo(G_STEM.id)} ${G_STEM.label}를 고르고, 끄기를 풀고, 메인 버튼을 켠다. 세 곳을 모두 고쳐야 소리가 난다.`,
  ],
  explanation:
    '"소리가 안 난다"는 신호 길 어딘가가 끊겼다는 뜻이다. 이번에는 입력 연결(연결 안 됨), 뮤트, 메인 보내기 세 곳이 한꺼번에 막혀 있었다. 하나를 고쳐도 소리가 안 나면 거기서 멈추지 말고 길을 끝까지 따라가야 한다. 현장에서는 입력 미터(신호가 들어오는가) → 채널 미터(채널을 지나는가) → 메인 미터 순서로 보면 끊긴 곳을 빨리 찾는다.',
  solve: (a, s) => {
    a.setPatch(GUITAR, inputOf(s, G_STEM.id));
    a.setMute(GUITAR, false);
    a.setMainAssign(GUITAR, true);
  },
  traps: [
    {
      label: '뮤트만 풀기',
      apply: (a) => a.setMute(GUITAR, false),
    },
    {
      label: '입력과 뮤트만 고치기',
      apply: (a, s) => {
        a.setPatch(GUITAR, inputOf(s, G_STEM.id));
        a.setMute(GUITAR, false);
      },
    },
  ],
};

const needs: [Mission, number[]][] = [
  [howl, [VOCAL]],
  [sermon, [SERMON]],
  [gain, GAIN_TARGETS],
  [noSound, [GUITAR]],
];
return needs.filter(([, chs]) => chs.every((c) => c >= 0)).map(([m]) => m);
}

export const MISSIONS: Mission[] = buildMissions(DEFAULT_SONG);

export function missionById(id: string): Mission | undefined {
  return MISSIONS.find((m) => m.id === id);
}
