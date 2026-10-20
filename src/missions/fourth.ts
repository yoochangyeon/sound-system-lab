// 4차 미션(기획서 8장 4차 행): 이펙트 센드, DCA, 솔로(PFL)로 범인 찾기, 씬과 리콜 세이프.
// 모두 쉬운 믹서의 전체 보기에서 푼다(view: 'full'). 채널은 역할로, 버스는 종류로 찾는다.
import { stemsFor, type Song, type StemRole } from '../audio/library';
import { busIndex, channelOfRole, mixerDefaultState } from '../mixer/mixer-state';
import { channelReachesMain, effectiveChannel } from '../stores/derived';
import type { MixerState, SceneSnapshot } from '../stores/mixer-model';
import type { Mission } from './types';

const inRange = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
const db = (v: number) => (Number.isFinite(v) ? `${v > 0 ? '+' : ''}${v.toFixed(1)}` : '−∞');

/** [미션, 그 미션이 쓰는 채널들]. 채널이 없는 곡에서는 빠진다. */
export function buildFourthMissions(song: Song): [Mission, number[]][] {
  const ch = (role: StemRole) => channelOfRole(song, role);
  const stemOf = (role: StemRole) => stemsFor(song, [role])[0];
  const inputOf = (s: MixerState, id: string | undefined) => s.inputs.findIndex((i) => i.stemId === id);
  const REVERB = busIndex('fx', 0);
  const VOCAL = ch('lead-vocal');

  // ---------------- 보컬이 너무 건조해요 ----------------
  /** 리버브 센드 판정 범위(dB). 너무 적으면 들리지 않고, 너무 많으면 가사가 잔향에 묻힌다. */
  const SEND_LO = -20;
  const SEND_HI = -3;
  const dryVocal: Mission = {
    id: 'dry-vocal',
    title: '보컬이 너무 건조해요',
    view: 'full',
    situation:
      '찬양 인도자가 "제 목소리가 너무 마른 느낌이에요"라고 한다. FX 1에 리버브가 걸려 있지만 리드 보컬은 리버브로 하나도 보내지 않았고, 리버브 리턴도 꺼져 있다. 원음은 그대로 두고 잔향만 살짝 더하자.',
    focusChannel: VOCAL,
    initial: {
      channels: { [VOCAL]: { sends: { [REVERB]: { levelDb: -Infinity, tap: 'post' } } } },
      auxes: { [REVERB]: { returnMute: true } },
    },
    judge: (s) => {
      const c = s.channels[VOCAL];
      const send = c.sends[REVERB].levelDb;
      const bus = s.auxes[REVERB];
      const returning = !bus.returnMute && bus.mainAssign && bus.returnDb !== -Infinity && !bus.mute && bus.faderDb !== -Infinity;
      const checks = [
        { label: `리드 보컬 → FX 1 리버브 보내는 양 ${db(send)} dB(${SEND_LO}~${SEND_HI} dB)`, ok: inRange(send, SEND_LO, SEND_HI) },
        { label: '리버브 리턴이 켜져 메인으로 돌아온다', ok: returning },
        { label: '원음은 그대로(채널에 인서트로 젖은 소리를 만들지 않았다)', ok: !c.insert.on && channelReachesMain(s, VOCAL) },
      ];
      return { passed: checks.every((x) => x.ok), checks };
    },
    hints: [
      '전체 보기에서 리드 보컬 채널 상세의 센드 탭을 본다. FX(이펙트) 칸이 있다.',
      'FX 1 리버브로 보내는 양을 −10 dB 안팎으로 올린다. 그래도 잔향이 안 들리면 돌아오는 쪽을 보자.',
      '출력의 FX 탭에서 FX 1 리버브의 "리턴 꺼짐"을 눌러 켠다. 메인 버튼도 켜져 있어야 한다.',
    ],
    explanation:
      '리버브는 보통 Send/Return으로 건다. 채널 소리를 복사해 FX 버스로 보내고(센드), 이펙트를 지난 잔향만 리턴으로 돌아와 메인에서 섞인다. 그래서 원음은 그대로이고, 보내는 양으로 잔향의 양을 정한다. 인서트로 리버브를 100% 걸면 원음까지 이펙트를 지나 가사가 흐려진다. 예배당은 방 자체에 울림이 있으므로 센드는 −20~−3 dB 사이에서 조금씩 올려 귀로 맞춘다(판정 범위). 이펙트 센드는 페이더 뒤(post)라 보컬 페이더를 내리면 잔향도 같이 줄어든다.',
    solve: (a) => {
      a.setSend(VOCAL, REVERB, { levelDb: -10 });
      a.setFxReturn(REVERB, { returnMute: false });
    },
    traps: [
      { label: '인서트 리버브 100%', apply: (a) => a.setInsert(VOCAL, { on: true, mixPct: 100 }) },
      {
        label: '센드를 끝까지 올리기',
        apply: (a) => {
          a.setSend(VOCAL, REVERB, { levelDb: 10 });
          a.setFxReturn(REVERB, { returnMute: false });
        },
      },
      { label: '센드만 올리고 리턴은 꺼진 채로', apply: (a) => a.setSend(VOCAL, REVERB, { levelDb: -10 }) },
    ],
  };

  // ---------------- 찬양팀 한 번에 줄이기 ----------------
  const BAND = (['kick', 'snare', 'toms', 'overheads', 'bass', 'guitar'] as StemRole[]).map(ch).filter((c) => c >= 0);
  const VOICES = (['lead-vocal', 'backing-vocal'] as StemRole[]).map(ch).filter((c) => c >= 0);
  const DROP_LO = 6;
  const DROP_HI = 20;
  const dcaBand: Mission = {
    id: 'dca-band',
    title: '찬양팀 한 번에 줄이기',
    view: 'full',
    situation:
      '찬양 마지막 곡이 끝나 가고 곧 대표 기도가 시작된다. 기도 동안 밴드는 잔잔하게 계속 연주한다. 밴드(드럼·베이스·기타) 여섯 채널을 함께 6 dB 넘게 낮춰야 하는데, 드럼과 기타 사이 균형은 리허설 때 맞춘 그대로 두고 싶다. 보컬은 그대로다.',
    focusChannel: BAND[0] ?? 0,
    initial: {},
    judge: (s, start) => {
      const drops = BAND.map((c) => effectiveChannel(start, c).faderDb - effectiveChannel(s, c).faderDb);
      const same = drops.every((d) => Math.abs(d - drops[0]) < 0.5);
      const enough = drops.every((d) => inRange(d, DROP_LO, DROP_HI));
      const raw = BAND.every((c) => s.channels[c].faderDb === start.channels[c].faderDb);
      const voices = VOICES.every((c) => effectiveChannel(s, c).faderDb === effectiveChannel(start, c).faderDb && channelReachesMain(s, c));
      const audible = BAND.every((c) => channelReachesMain(s, c));
      const checks = [
        { label: `밴드 여섯 채널이 같은 양만큼 내려갔다(${DROP_LO}~${DROP_HI} dB)`, ok: same && enough },
        { label: '채널 페이더 사이 균형은 그대로(채널 페이더는 건드리지 않았다)', ok: raw },
        { label: '밴드는 끄지 않고 계속 들린다', ok: audible },
        { label: '보컬은 그대로', ok: voices },
      ];
      return { passed: checks.every((x) => x.ok), checks };
    },
    hints: [
      '여러 채널을 같은 양만큼 함께 움직이는 원격 페이더가 있다. 전체 보기의 콘솔 기능 카드를 보자.',
      '밴드 채널마다 채널 상세 → 설정 탭에서 DCA 1을 눌러 묶는다. 채널 줄에 D1 표시가 생긴다.',
      '콘솔 기능 → DCA 탭에서 DCA 1을 −8 dB쯤 내린다.',
    ],
    explanation:
      'DCA는 소리가 지나가지 않는 원격 페이더다. 묶인 채널의 페이더 값에 DCA 값을 더할 뿐이라, 드럼과 기타 사이의 균형은 그대로 두고 한꺼번에 내린다. 채널 페이더를 하나씩 내리면 시간이 걸리고, 다시 올릴 때 원래 자리를 잃기 쉽다. 뮤트 그룹으로 끄면 연주가 아예 사라진다. 판정 범위(6~20 dB)는 기도 중에도 반주가 들리면서 말소리를 덮지 않는 정도로 정했다.',
    solve: (a) => {
      for (const c of BAND) a.setDcaMember(0, c, true);
      a.setDca(0, { faderDb: -8 });
    },
    traps: [
      { label: '채널 페이더를 하나씩 내리기', apply: (a, s) => BAND.forEach((c) => a.setFader(c, s.channels[c].faderDb - 8)) },
      {
        label: '뮤트 그룹으로 끄기',
        apply: (a) => {
          for (const c of BAND) a.setMuteGroupMember(0, c, true);
          a.setMuteGroup(0, true);
        },
      },
      { label: '메인 페이더 내리기', apply: (a) => a.setBusFader('main', -8) },
    ],
  };

  // ---------------- 엉뚱한 소리 범인 찾기 ----------------
  const BV = ch('backing-vocal');
  const BV_STEM = song.stems.find((x) => x.key === song.mixer[BV]?.stem);
  const PERC = stemOf('percussion');
  const findNoise: Mission = {
    id: 'find-noise',
    title: '엉뚱한 소리 범인 찾기',
    view: 'full',
    situation:
      '예배 중 메인에서 "찰찰" 하는 탬버린 소리가 들린다. 오늘은 탬버린 연주자가 없고, 무대 위 탬버린 마이크는 꺼 두었다고 한다. 어느 채널에서 나는 소리인지 찾아 바로잡자. 메인 소리를 끊지 않고 찾아야 한다.',
    focusChannel: 0,
    initial: {},
    judge: (s) => {
      const want = inputOf(s, BV_STEM ? stemsFor(song).find((x) => x.key === BV_STEM.key)?.id : undefined);
      const c = s.channels[BV];
      const checks = [
        { label: `${c.name} 채널에 제 입력(IN ${want + 1})이 다시 연결됐다`, ok: s.patch[BV] === want },
        { label: `${c.name} 채널이 메인으로 나온다(끄지 않고 고쳤다)`, ok: channelReachesMain(s, BV) },
        { label: '솔로를 모두 풀었다', ok: !s.channels.some((x) => x.solo) },
      ];
      return { passed: checks.every((x) => x.ok), checks };
    },
    hints: [
      '메인을 끊지 않고 채널 하나만 골라 듣는 기능이 있다. 채널 줄의 솔로 버튼을 보자(콘솔 기능 → 솔로에서 PFL인지 확인).',
      '채널을 하나씩 솔로로 들어 본다. 이름과 다른 소리가 나는 채널이 범인이다.',
      `범인 채널의 입력 탭에서 연결된 입력을 제 소스(${BV_STEM?.label ?? '백킹 보컬'})로 바꾸고, 솔로를 모두 해제한다.`,
    ],
    explanation:
      '솔로(PFL)는 메인 스피커 소리는 그대로 두고, 고른 채널만 이어폰으로 들려준다. 페이더 앞에서 듣기 때문에 페이더가 내려가 있거나 꺼진 채널도 들린다. 범인은 백킹 보컬 채널에 탬버린 입력이 잘못 연결된 것이었다. 채널을 끄면 소리는 사라지지만 백킹 보컬까지 사라진다. 연결을 바로잡는 것이 해결이다. 찾고 나면 솔로를 꼭 풀어야 다음 사람이 헷갈리지 않는다.',
    solve: (a, s) => {
      const want = inputOf(s, stemsFor(song).find((x) => x.key === BV_STEM?.key)?.id);
      a.setPatch(BV, want);
      a.clearSolo();
    },
    traps: [
      { label: '범인 채널 끄기', apply: (a) => a.setMute(BV, true) },
      { label: '연결 끊기', apply: (a) => a.setPatch(BV, null) },
      {
        label: '고치고 솔로를 켠 채로 두기',
        apply: (a, s) => {
          a.setPatch(BV, inputOf(s, stemsFor(song).find((x) => x.key === BV_STEM?.key)?.id));
          a.setSolo(BV, true);
        },
      },
    ],
  };
  // 시작 상태: 백킹 보컬 채널에 탬버린 입력을 꽂는다(입력 번호는 곡의 소스 순서).
  if (PERC && BV >= 0) {
    const percInput = stemsFor(song).findIndex((x) => x.id === PERC.id);
    findNoise.initial = { patch: { [BV]: percInput } };
  }

  // ---------------- 설교 순서 불러오기 ----------------
  const SCENE: SceneSnapshot = (() => {
    const base = mixerDefaultState(song);
    const channels = base.channels.map((c, i) => {
      if (BAND.includes(i)) return { ...c, mute: true };
      if (i === VOCAL) return { ...c, faderDb: -6, preamp: { ...c.preamp, hpfOn: false } }; // 지난주 설교자 설정
      if (VOICES.includes(i)) return { ...c, faderDb: -Infinity };
      return c;
    });
    return { channels, main: base.main, auxes: base.auxes, matrix: base.matrix, dca: base.dca, muteGroups: base.muteGroups, links: base.links };
  })();
  const pick = (c: MixerState['channels'][number]) => JSON.stringify({ ...c, solo: false });
  const sceneSermon: Mission = {
    id: 'scene-sermon',
    title: '설교 순서 불러오기',
    view: 'full',
    situation:
      '찬양이 끝나고 설교가 시작된다. 지난주에 저장해 둔 "설교" 씬(밴드 끄기, 백킹 보컬 내리기)이 씬 1에 있다. 그런데 설교자 마이크(리드 보컬 채널)는 오늘 아침 리허설에서 새로 맞췄다. 씬을 불러오되 오늘 맞춘 설교자 마이크는 지켜야 한다.',
    focusChannel: VOCAL,
    initial: {
      scenes: { 0: { name: '설교', snapshot: SCENE } },
      // 오늘 아침 새로 맞춘 설교자 마이크
      channels: { [VOCAL]: { faderDb: 2, preamp: { hpfOn: true, hpfFreq: 120 }, comp: { on: true, thresholdDb: -24, ratio: 3 } } },
    },
    judge: (s, start) => {
      const others = SCENE.channels.every((sc, i) => i === VOCAL || (s.channels[i].mute === sc.mute && s.channels[i].faderDb === sc.faderDb));
      const kept = pick(s.channels[VOCAL]) === pick(start.channels[VOCAL]);
      const checks = [
        { label: '씬 "설교"의 값이 나머지 채널에 적용됐다(밴드 꺼짐, 백킹 보컬 내림)', ok: others },
        { label: '오늘 맞춘 설교자 마이크(리드 보컬)는 그대로', ok: kept },
      ];
      return { passed: checks.every((x) => x.ok), checks };
    },
    hints: [
      '전체 보기의 콘솔 기능 → 씬 탭에 "설교" 씬이 저장되어 있다. 그냥 불러오면 무엇이 덮일까?',
      '씬을 불러와도 바뀌지 않게 지키는 기능이 있다. 리드 보컬 채널 상세 → 설정 탭 맨 아래를 보자.',
      '리드 보컬의 리콜 세이프를 켜고, 씬 탭에서 "설교"를 불러온다.',
    ],
    explanation:
      '씬은 믹서 상태 전체를 저장했다가 한 번에 불러온다. 예배 순서마다 씬을 두면 찬양에서 설교로 넘어갈 때 여러 채널을 하나씩 만지지 않아도 된다. 다만 그날 새로 맞춘 채널까지 지난번 값으로 덮인다. 리콜 세이프를 켠 채널은 씬을 불러와도 그대로 남는다. 손으로 밴드를 하나씩 끄는 것은 씬이 하는 일을 다 따라 하지 못하고, 세이프 없이 부르면 설교자 마이크가 지난주 설정(HPF 꺼짐, 페이더 −6 dB)으로 돌아간다.',
    solve: (a) => {
      a.setSafe(VOCAL, true);
      a.recallScene(0);
    },
    traps: [
      { label: '세이프 없이 씬 불러오기', apply: (a) => a.recallScene(0) },
      { label: '밴드만 손으로 끄기', apply: (a) => BAND.forEach((c) => a.setMute(c, true)) },
    ],
  };

  return [
    [dryVocal, [VOCAL, REVERB]],
    [dcaBand, BAND.length === 6 ? BAND : [-1]],
    [findNoise, PERC && BV_STEM ? [BV] : [-1]],
    [sceneSermon, [VOCAL]],
  ];
}
