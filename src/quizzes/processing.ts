// 2장 실전 퀴즈. 수치와 사실은 2장 레슨 원고(출처 주석 포함)를 벗어나지 않는다.
import type { Quiz } from './types';

const P1 = '02-processing/01-preamp';
const P2 = '02-processing/02-eq-basics';
const P3 = '02-processing/03-peq-hpf';
const P4 = '02-processing/04-geq-feedback';
const P5 = '02-processing/05-compressor';
const P6 = '02-processing/06-gate';

export const PROCESSING: Quiz[] = [
  // ---------- 1. 프리엠프 ----------
  {
    id: 'pre-faders-uneven',
    lesson: P1,
    level: 1,
    title: '페이더가 제각각인 믹스',
    scene: '리허설이 끝났다. 드럼 페이더는 바닥 근처, 건반 페이더는 끝까지 올라가 있다. 그래도 건반은 잘 안 들린다.',
    steps: [
      {
        prompt: '가장 먼저 손댈 곳은?',
        options: [
          { text: '건반 EQ에서 고음을 올린다', feedback: '크기 문제를 EQ로 풀면 잡음과 하울링만 늘어난다.' },
          { text: '채널마다 프리엠프 게인', correct: true, feedback: '맨 앞의 게인이 채널마다 맞지 않으면 페이더가 제각각이 된다. 게인부터 맞추면 페이더가 비슷한 자리에 모인다.' },
          { text: '메인 페이더', feedback: '모든 채널이 같이 움직여 균형은 그대로다.' },
        ],
        clue: '페이더가 제각각 → 게인이 채널마다 안 맞음',
      },
    ],
    takeaway: '게인 먼저, 페이더는 나중.',
  },
  {
    id: 'pre-keys-math',
    lesson: P1,
    level: 2,
    title: '건반 게인은 얼마나 올릴까',
    scene: '건반 채널의 입력 미터를 보니, 가장 큰 순간의 피크가 −40 dBFS다. 목표는 피크를 −12 dBFS 근처에 두는 것이다.',
    steps: [
      {
        prompt: '게인을 몇 dB쯤 올려야 할까?',
        options: [
          { text: '약 +8 dB', feedback: '−40 + 8 = −32 dBFS. 아직 한참 작다.' },
          { text: '약 +52 dB', feedback: '−40 + 52 = +12 dBFS. 천장을 넘어 깨진다.' },
          { text: '약 +28 dB', correct: true, feedback: 'dB는 더하기로 계산한다. −40 + 28 = −12 dBFS.' },
        ],
        clue: '−40 → −12 dBFS: 게인 +28 dB',
      },
      {
        prompt: '게인을 올렸더니 건반이 믹스에서 조금 크다. 이제 무엇으로 맞출까?',
        options: [
          { text: '게인을 다시 내린다', feedback: '게인은 입력 크기 기준으로 이미 맞췄다. 믹스 속 균형은 다음 단계의 일이다.' },
          { text: '건반 채널 페이더를 조금 내린다', correct: true, feedback: '게인으로 기본 크기를, 페이더로 믹스 속 크기를 정한다.' },
          { text: '컴프레서를 건다', feedback: '크기 차이를 줄이는 장치이지, 균형을 맞추는 손잡이가 아니다.' },
        ],
        clue: '균형은 페이더로',
      },
    ],
    takeaway: 'dB는 더하기다. 게인으로 피크를 맞추고 균형은 페이더로.',
  },
  {
    id: 'pre-escape-handover',
    lesson: P1,
    level: 3,
    title: '인수인계받은 엉망 믹스',
    scene: '1부 예배를 맡았던 봉사자가 급히 떠났다. 2부 리허설 시작 전, 채널 입력 미터를 하나씩 보며 믹스를 정리하자.',
    steps: [
      {
        prompt: '입력 미터를 하나씩 확인한다.',
        inspect: [
          { label: '드럼', reading: '큰 순간마다 빨간 칸이 깜빡인다' },
          { label: '보컬', reading: '피크 약 −12 dBFS' },
          { label: '셰이커', reading: '피크 약 −45 dBFS' },
          { label: '일렉 기타', reading: '빨간 칸이 자주 켜진다' },
        ],
        options: [
          { text: '보컬과 셰이커', feedback: '보컬 −12 dBFS는 알맞은 자리다.' },
          { text: '드럼과 일렉 기타', correct: true, feedback: '빨간 칸이 켜지는 두 채널은 프리앰프에서 클리핑이 난다. 게인을 내려야 한다.' },
          { text: '셰이커만', feedback: '셰이커는 반대로 너무 작은 쪽이다.' },
        ],
        clue: '클리핑: 드럼·일렉 기타 → 게인 내리기',
      },
      {
        prompt: '반대로 너무 작은 채널은?',
        options: [
          { text: '셰이커', correct: true, feedback: '−45 dBFS는 목표(−18 ~ −6)보다 한참 작다. 게인을 올린다.' },
          { text: '보컬', feedback: '보컬은 알맞다.' },
          { text: '드럼', feedback: '드럼은 너무 큰 쪽이었다.' },
        ],
        clue: '너무 작음: 셰이커 → 게인 올리기',
      },
      {
        prompt: '어떤 순서로 정리할까?',
        options: [
          { text: '페이더로 먼저 들리는 크기를 맞추고, 남는 문제만 게인으로', feedback: '깨진 소리는 페이더로 되살릴 수 없다. 순서가 반대다.' },
          { text: '모든 채널 게인을 먼저 맞춘 뒤, 페이더로 믹스 크기를 정한다', correct: true, feedback: '게인 스테이징 순서다. 그래야 페이더가 비슷한 자리에 모이고 조정 여유가 생긴다.' },
          { text: '컴프레서로 모든 채널을 고르게 만든다', feedback: '클리핑은 컴프레서보다 앞에서 생긴다.' },
        ],
        clue: '순서: 게인 전부 → 페이더',
      },
      {
        prompt: '드럼 게인을 내렸다. 함께 다시 봐야 할 것은?',
        options: [
          { text: '드럼 채널의 게이트·컴프레서 스레숄드', correct: true, feedback: '게인이 바뀌면 같은 스레숄드라도 걸리는 양이 달라진다. 다시 맞춘다.' },
          { text: '메인 GEQ', feedback: '게인 변경과 직접 관계없다.' },
          { text: '모니터 스피커 위치', feedback: '스피커 자리는 하울링 문제다. 게인을 바꿨을 때 다시 볼 것은 그 채널의 처리기다.' },
        ],
        clue: '게인을 바꾸면 게이트·컴프 스레숄드도 다시',
      },
    ],
    takeaway: '입력 미터로 너무 큰 채널·너무 작은 채널을 가려 게인부터 맞추고, 뒤의 처리기를 다시 본다.',
  },

  // ---------- 2. EQ 기초 ----------
  {
    id: 'eqb-kick-cymbal',
    lesson: P2,
    level: 1,
    title: '킥 드럼 채널에 섞인 "치익"',
    scene: '킥 드럼 마이크로 심벌의 "치익" 소리가 많이 새어 들어온다. 킥에는 높은 소리가 거의 필요 없다.',
    steps: [
      {
        prompt: '어떤 필터를 쓸까?',
        options: [
          { text: 'LPF(고음 자르기)', correct: true, feedback: 'LPF는 정한 주파수보다 높은 소리를 깎는다. 높은 소리가 필요 없는 채널에서 위쪽 잡음과 새어 든 소리를 줄인다.' },
          { text: 'HPF(저음 자르기)', feedback: 'HPF는 낮은 소리를 깎는다. 킥의 "쿵"이 사라진다.' },
          { text: 'Q를 아주 크게', feedback: 'Q는 피킹 밴드의 폭이다. 위쪽 전체를 자르는 손잡이가 아니다.' },
        ],
        clue: '위쪽을 자르는 필터 = LPF',
      },
    ],
    takeaway: '이름은 통과시키는 쪽. LPF는 낮은 소리를 통과시키고 위를 자른다.',
  },
  {
    id: 'eqb-q-width',
    lesson: P2,
    level: 2,
    title: 'Q를 얼마나 할까',
    scene: '보컬에서 특정 한 음이 날 때만 "삐" 하고 날카롭게 튄다. 그 주파수는 찾았다.',
    steps: [
      {
        prompt: 'Q를 크게 하면 종 모양은 어떻게 될까?',
        options: [
          { text: '넓어진다', feedback: '반대다. Q가 클수록 좁다.' },
          { text: '좁아진다', correct: true, feedback: 'Q는 폭이다. 숫자가 클수록 좁은 대역만 건드린다.' },
          { text: '높이가 커진다', feedback: '높이는 올리기·내리기(게인)가 정한다.' },
        ],
        clue: 'Q가 클수록 좁다',
      },
      {
        prompt: '한 음만 튀는 문제에는?',
        options: [
          { text: 'Q를 작게 해서 넓게 깎는다', feedback: '주변의 멀쩡한 소리까지 깎여 목소리가 빈약해진다.' },
          { text: '셸프로 위쪽 전체를 내린다', feedback: '튀는 한 음 때문에 위쪽 전체가 어두워진다.' },
          { text: 'Q를 크게 해서 그 주파수만 좁게 깎는다', correct: true, feedback: '거슬리는 한 음은 좁게 집어 깎는다.' },
        ],
        clue: '한 음만 튐 → Q 크게, 좁게 깎기',
      },
    ],
    takeaway: '좁은 문제는 큰 Q로, 전체 색은 작은 Q나 셸프로.',
  },
  {
    id: 'eqb-escape-four-knobs',
    lesson: P2,
    level: 3,
    title: '보컬 소리 진단서',
    scene: '한 보컬 채널에 문제가 여러 개 겹쳐 있다. 단서마다 맞는 EQ 손잡이를 골라 차례로 고쳐 보자.',
    steps: [
      {
        prompt: '첫 번째 단서를 연다.',
        inspect: [{ label: '증상 ①', reading: '숨 "펑" 소리와 바닥을 구르는 듯한 낮은 울림' }],
        options: [
          { text: 'LPF를 켠다', feedback: 'LPF는 위쪽을 자른다. 문제는 아래쪽이다.' },
          { text: 'HPF를 켜고 차단 주파수를 올린다', correct: true, feedback: '목소리에 필요 없는 아래쪽은 HPF로 자른다.' },
          { text: '3 kHz를 올린다', feedback: '아래쪽 문제가 그대로 남는다.' },
        ],
        clue: '"펑"·낮은 울림 → HPF',
      },
      {
        prompt: '두 번째 단서를 연다.',
        inspect: [{ label: '증상 ②', reading: '어떤 한 음에서만 "삐" 하고 귀를 찌른다' }],
        options: [
          { text: '피킹 밴드로 그 주파수를 찾아 Q를 크게 해서 깎는다', correct: true, feedback: '한 음 문제는 좁게 집어 깎는다.' },
          { text: '하이 셸프로 위쪽 전체를 크게 깎는다', feedback: '튀는 한 음 때문에 목소리 전체가 어두워진다.' },
          { text: 'HPF를 더 올린다', feedback: 'HPF는 아래쪽을 자른다. 위쪽의 한 음과 관계없다.' },
        ],
        clue: '한 음만 튐 → 피킹, Q 크게, 깎기',
      },
      {
        prompt: '세 번째 단서를 연다.',
        inspect: [{ label: '증상 ③', reading: '전체적으로 살짝 차갑고 얇다' }],
        options: [
          { text: 'Q를 아주 크게 해서 300 Hz를 +12 dB', feedback: '좁고 크게 올리면 한 음이 튀어나온다. 전체 색은 넓고 살짝 바꾼다.' },
          { text: '200~500 Hz 근처를 넓은 Q(또는 셸프)로 살짝 올린다', correct: true, feedback: '"따뜻함"은 200~500 Hz 근처다. 전체 색은 넓게, 조금만.' },
          { text: 'LPF를 4 kHz로 내린다', feedback: '말의 또렷한 부분까지 깎여 답답해진다.' },
        ],
        clue: '전체가 차가움 → 200~500 Hz를 넓게 살짝',
      },
      {
        prompt: '세 가지를 모두 할 때 지켜야 할 순서 원칙은?',
        options: [
          { text: '올리기를 먼저 하고, 나중에 깎는다', feedback: '올리면 하울링과 헤드룸 문제가 먼저 생긴다.' },
          { text: '자르기·깎기를 먼저 하고, 올리기는 마지막에 조금만', correct: true, feedback: '먼저 덜어 내고, 모자란 것만 조금 올린다.' },
          { text: '순서는 상관없다', feedback: '같은 결과라도 깎는 쪽이 안전하다.' },
        ],
        clue: '원칙: 자르기·깎기 → 조금 올리기',
      },
    ],
    takeaway: '증상마다 손잡이가 다르다. 아래쪽은 HPF, 한 음은 좁은 Q, 전체 색은 넓게. 깎기가 먼저다.',
  },

  // ---------- 3. PEQ + HPF ----------
  {
    id: 'peq-first-move',
    lesson: P3,
    level: 1,
    title: '설교가 웅웅거릴 때 첫 손',
    scene: '설교가 시작되자 말씀이 웅웅 울린다. 설교 채널의 HPF는 꺼져 있다.',
    steps: [
      {
        prompt: '첫 조작은?',
        options: [
          { text: 'LPF를 켜고 2 kHz까지 내린다', feedback: '말의 또렷한 부분까지 깎여 더 답답해진다. 웅웅은 아래쪽 문제다.' },
          { text: 'HPF를 켜고 100 Hz 근처에서 시작한다', correct: true, feedback: '말소리에 필요 없는 아래쪽부터 자른다. 들으며 조정한다.' },
          { text: '설교 페이더를 올린다', feedback: '웅웅거림도 같이 커진다.' },
        ],
        clue: '설교 웅웅 → HPF 100 Hz 근처부터',
      },
    ],
    takeaway: '말하는 마이크에는 HPF부터.',
  },
  {
    id: 'peq-too-thin',
    lesson: P3,
    level: 2,
    title: 'HPF를 올렸더니 얇아졌다',
    scene: '웅웅거림을 잡으려고 HPF 차단 주파수를 250 Hz까지 올렸다. 웅웅은 사라졌지만 목소리가 가늘고 힘이 없다.',
    steps: [
      {
        prompt: '어떻게 할까?',
        options: [
          { text: '얇아지기 시작한 지점에서 조금 되돌린다', correct: true, feedback: 'HPF는 얇아지기 직전까지만 올린다. 지나치면 목소리 몸통까지 깎인다.' },
          { text: '그대로 두고 200~500 Hz를 크게 올린다', feedback: '자르고 다시 올리면 돌고 돌 뿐이다. 먼저 HPF를 되돌린다.' },
          { text: 'HPF를 끈다', feedback: '처음 문제(웅웅)가 다시 생긴다.' },
        ],
        clue: 'HPF는 얇아지기 직전까지',
      },
      {
        prompt: 'HPF를 적당히 되돌렸는데 아직 먹먹하다. 먹먹한 자리를 찾는 요령은?',
        options: [
          { text: '처음부터 −10 dB로 깎으며 주파수를 옮긴다', feedback: '깎은 채로 찾으면 어디가 문제인지 귀로 구분하기 어렵다.' },
          { text: 'LPF를 내려 본다', feedback: '먹먹함은 위쪽이 아니라 200~500 Hz 근처가 많을 때 흔하다.' },
          { text: '중저음 밴드를 잠깐 +6 dB 올려 200~500 Hz를 훑고, 가장 웅웅거리는 자리를 찾아 깎는다', correct: true, feedback: '일부러 문제를 키워 찾고, 찾으면 −3 ~ −6 dB쯤 깎는다.' },
        ],
        clue: '일부러 키워 찾고 → 깎기',
      },
    ],
    takeaway: 'HPF는 얇아지기 직전까지, 먹먹함은 키워서 찾고 깎는다.',
  },
  {
    id: 'peq-escape-new-preacher',
    lesson: P3,
    level: 3,
    title: '설교자가 바뀐 주일',
    scene: '지난주 담임 목사님 설교에 맞춰 둔 설정 그대로 이번 주 초청 목사님이 설교를 시작했다. 소리가 영 어색하다.',
    steps: [
      {
        prompt: '지금 설정과 소리를 확인한다.',
        inspect: [
          { label: '설교 채널 설정', reading: 'HPF 140 Hz, 중저음 300 Hz −5 dB' },
          { label: '들리는 소리', reading: '가늘고 힘이 없다' },
          { label: '초청 목사님 마이크', reading: '입에서 꽤 떨어져 말씀하신다' },
        ],
        options: [
          { text: '설정은 그대로 두고 페이더만 올린다', feedback: '설정이 새 목소리와 맞지 않는다. 설교자가 바뀌면 다시 듣는다.' },
          { text: '지난주 설정이 이번 목소리에는 너무 많이 깎고 있다', correct: true, feedback: '마이크에서 멀면 근접 효과가 적어 저음이 원래 적다. 거기에 HPF와 중저음 깎기가 더해져 얇아졌다.' },
          { text: '컴프레서가 너무 세다', feedback: '단서는 크기 변화가 아니라 "가늘다"를 가리킨다.' },
        ],
        clue: '설교자가 바뀜 + 마이크가 멂 → 지난주 깎기가 과함',
      },
      {
        prompt: '먼저 무엇을 되돌릴까?',
        options: [
          { text: 'HPF를 끄고 저음을 +6 dB 올린다', feedback: '한 번에 크게 바꾸면 다시 웅웅거린다. 조금씩 되돌린다.' },
          { text: '중저음 깎기를 줄이고(0 쪽으로), HPF도 얇아지지 않는 자리까지 내린다', correct: true, feedback: '과하게 깎은 것부터 되돌린다. 들으며 조금씩.' },
          { text: 'LPF를 켠다', feedback: '위쪽을 자르면 더 답답하고 힘이 없어진다.' },
        ],
        clue: '중저음 깎기를 줄이고 HPF를 내렸다',
      },
      {
        prompt: '아직 말이 멀게 들린다. 다음은?',
        options: [
          { text: '2~4 kHz 대역을 +2 dB쯤 살짝 올려 본다', correct: true, feedback: '말의 또렷함은 2 kHz 위쪽이 크게 좌우한다. 조금만 올린다.' },
          { text: '2~4 kHz를 +12 dB', feedback: '귀를 찌르고 하울링이 쉬워진다.' },
          { text: 'HPF를 다시 올린다', feedback: '얇아진 문제로 돌아간다.' },
        ],
        clue: '또렷함은 2~4 kHz를 조금',
      },
      {
        prompt: '이 상황에서 LPF는?',
        options: [
          { text: '4 kHz로 켜서 거친 소리를 줄인다', feedback: '말의 또렷한 부분까지 깎여 더 멀게 들린다.' },
          { text: '꺼 둔다. 위쪽 "쉬익" 잡음이 거슬릴 때만 높은 곳에서 살짝 쓴다', correct: true, feedback: '이번 문제는 위쪽이 아니다. 필요 없는 손잡이는 만지지 않는다.' },
          { text: '1 kHz로 켜서 따뜻하게 만든다', feedback: '말소리가 거의 다 깎인다.' },
        ],
        clue: 'LPF는 꺼 둠',
      },
    ],
    takeaway: '설교자가 바뀌면 설정을 다시 듣는다. 과한 깎기부터 되돌리고, 또렷함은 조금만.',
  },

  // ---------- 4. GEQ·하울링 ----------
  {
    id: 'geq-which-output',
    lesson: P4,
    level: 1,
    title: '하울링! 제일 먼저 볼 것',
    scene: '찬양 중 "삐-" 하는 소리가 커진다. 손이 떨려 무엇이든 내리고 싶다.',
    steps: [
      {
        prompt: '전체를 끄기 전에 먼저 확인할 것은?',
        options: [
          { text: '어느 출력(메인인지, 어느 모니터인지)에서 나는지', correct: true, feedback: '어디서 나는지 알아야 그 출력의 RTA와 GEQ를 연다. 메인을 다 끄면 예배가 멈춘다.' },
          { text: '메인 페이더를 끝까지 내린다', feedback: '하울링이 모니터에서 났다면 메인을 꺼도 계속된다. 예배 소리만 끊긴다.' },
          { text: '모든 채널 EQ를 평평하게', feedback: '시간이 너무 걸리고 원인과 관계없을 수 있다.' },
        ],
        clue: '먼저 어느 출력인지',
      },
    ],
    takeaway: '하울링이 나면 먼저 어디서 나는지를 본다.',
  },
  {
    id: 'geq-screech',
    lesson: P4,
    level: 2,
    title: '"끼익" 하는 모니터',
    scene: '보컬 모니터에서 "끼익" 하는 날카로운 하울링이 난다.',
    steps: [
      {
        prompt: '소리 느낌으로 대략 어느 쪽일까?',
        options: [
          { text: '250~500 Hz 근처', feedback: '그쪽은 "우웅" 하는 낮은 울림에 가깝다.' },
          { text: '1 kHz 근처', feedback: '"삐-" 하고 노래하듯 우는 쪽이다.' },
          { text: '2 kHz 위', correct: true, feedback: '"끼익" 하는 날카로운 소리는 대개 2 kHz 위다. 다만 짐작일 뿐, 정확한 주파수는 RTA로 확인한다.' },
        ],
        clue: '"끼익" → 대략 2 kHz 위(짐작)',
      },
      {
        prompt: '모니터 RTA를 여니 2.5 kHz 막대 하나가 혼자 튀어나와 있다. 조치는?',
        options: [
          { text: '모니터 GEQ의 2.5 kHz 밴드 하나를 하울링이 멈출 만큼 내린다', correct: true, feedback: '그 밴드만 깎으면 나머지 소리는 거의 그대로 둔 채 하울링을 멈춘다.' },
          { text: '2~5 kHz 근처 슬라이더를 모두 크게 내린다', feedback: '멈추긴 하지만 보컬이 멀고 얇게 들린다.' },
          { text: '모니터 페이더를 내린다', feedback: '인도자가 자기 소리를 못 듣는다.' },
        ],
        clue: 'RTA로 찾은 한 밴드만 깎기',
      },
    ],
    takeaway: '소리로 짐작하고, RTA로 확인하고, 한 밴드만 깎는다.',
  },
  {
    id: 'geq-escape-ringout',
    lesson: P4,
    level: 3,
    title: '예배 30분 전, 링아웃 작전',
    scene: '이번 주부터 모니터 위치가 바뀌었다. 예배 전에 하울링이 날 주파수를 미리 찾아 깎아 두자.',
    steps: [
      {
        prompt: '첫 단계는?',
        options: [
          { text: '마이크를 실제 자리에 두고 모니터를 천천히 올린다', correct: true, feedback: '링아웃은 실제 자리에서, 하울링 직전까지 천천히 올리며 찾는다.' },
          { text: '모니터 GEQ를 미리 전부 −6 dB', feedback: '어디가 문제인지 모른 채 다 깎으면 모니터 소리만 나빠진다.' },
          { text: '예배 중에 하울링이 나면 그때 잡는다', feedback: '예배 중에 터지면 늦다.' },
        ],
        clue: '실제 자리에서 모니터를 천천히 올림',
      },
      {
        prompt: '울리기 시작했다. RTA를 확인한다.',
        inspect: [
          { label: 'RTA', reading: '1 kHz 막대가 혼자 튀어나와 있다' },
          { label: '소리', reading: '"삐-" 하고 노래하듯 운다' },
        ],
        options: [
          { text: '1 kHz 밴드를 3 dB쯤 깎는다', correct: true, feedback: '현장 링아웃은 한 번에 3 dB쯤씩 깎으며 반복하는 방법이 흔히 권장된다.' },
          { text: '1 kHz 밴드를 −15 dB 끝까지 깎는다', feedback: '필요 이상으로 깎는다고 더 잘 막히지 않는다. 조금씩 깎고 다시 올려 본다.' },
          { text: '250 Hz를 깎는다', feedback: 'RTA는 1 kHz를 가리켰다.' },
        ],
        clue: 'RTA 1 kHz → 3 dB 깎기',
      },
      {
        prompt: '다시 조금 올렸더니 이번엔 630 Hz와 2.5 kHz가 거의 동시에 울리기 시작한다. 어떻게 할까?',
        options: [
          { text: '둘 다 깎고 계속 올린다', feedback: '여러 주파수가 한꺼번에 울리기 시작하면 한계에 가깝다.' },
          { text: '여기서 멈춘다. 이보다 조금 낮은 크기가 쓸 수 있는 한계다', correct: true, feedback: '여러 주파수가 한꺼번에 울리면 링아웃을 멈춘다.' },
          { text: 'GEQ를 평평하게 하고 처음부터 다시', feedback: '찾아 둔 1 kHz 결과까지 버리게 된다.' },
        ],
        clue: '여러 주파수가 동시에 울리면 멈춤',
      },
      {
        prompt: '예배 중에도 다른 주파수에서 자꾸 운다. 무엇을 다시 볼까?',
        options: [
          { text: 'GEQ를 더 많이 깎는다', feedback: 'GEQ는 마지막 수단이다. 자리가 잘못되면 깎아도 다른 주파수에서 또 운다.' },
          { text: '모니터를 끈다', feedback: '연주자가 자기 소리를 못 듣는다.' },
          { text: '모니터와 마이크의 자리·방향, 마이크 거리, 열린 마이크 수', correct: true, feedback: '1장에서 본 자리 문제가 먼저다.' },
        ],
        clue: '계속 울면 GEQ보다 자리부터',
      },
    ],
    takeaway: '링아웃은 실제 자리에서 조금씩. 계속 울면 GEQ보다 자리를 다시 본다.',
  },

  // ---------- 5. 컴프레서 ----------
  {
    id: 'comp-no-gr',
    lesson: P5,
    level: 1,
    title: 'GR 미터가 꼼짝 안 한다',
    scene: '인도자 보컬에 컴프레서를 켰다. 그런데 후렴에서 힘껏 불러도 GR 미터가 전혀 움직이지 않는다.',
    steps: [
      {
        prompt: '가장 그럴듯한 이유는?',
        options: [
          { text: '레이시오가 너무 크다', feedback: '레이시오가 커도 스레숄드를 넘어야 눌린다.' },
          { text: '스레숄드가 너무 높아서 넘는 소리가 없다', correct: true, feedback: '컴프레서는 스레숄드를 넘는 소리만 누른다. 스레숄드를 내려 큰 소리에서만 GR이 움직이는 자리를 찾는다.' },
          { text: '메이크업이 0이다', feedback: '메이크업은 누른 뒤 다시 올리는 양이다. GR과 관계없다.' },
        ],
        clue: 'GR 0 → 스레숄드가 너무 높음',
      },
    ],
    takeaway: 'GR이 안 움직이면 스레숄드부터 본다.',
  },
  {
    id: 'comp-squashed',
    lesson: P5,
    level: 2,
    title: '답답하게 눌린 보컬',
    scene: '보컬 컴프 설정이 레이시오 20:1, GR이 늘 −15 dB 근처다. 소리가 납작하고 답답하다.',
    steps: [
      {
        prompt: '먼저 무엇을 바꿀까?',
        options: [
          { text: '레이시오를 2:1~4:1로 낮추고, 큰 소리에서 GR이 4~5 dB쯤 움직이게 스레숄드를 맞춘다', correct: true, feedback: '라이브 보컬은 부드러운 레이시오에서 시작한다. 8 dB 넘게 누르면 눌린 티가 나기 쉽다.' },
          { text: '어택을 아주 짧게 한다', feedback: '어택을 바꿔도 너무 세게 누르는 문제는 그대로다.' },
          { text: '메이크업을 크게 올린다', feedback: '크기만 커지고 납작함은 그대로다.' },
        ],
        clue: '레이시오 낮추고 GR 4~5 dB 목표',
      },
      {
        prompt: '설정을 고쳤더니 켰을 때 소리가 작아져서, 봉사자가 "꺼진 쪽이 더 좋다"고 한다. 어떻게 비교해야 공정할까?',
        options: [
          { text: '꺼진 쪽이 좋다니 컴프를 끈다', feedback: '크기가 다르면 큰 쪽이 그냥 좋게 들린다. 공정한 비교가 아니다.' },
          { text: '페이더를 올려서 비교한다', feedback: '처리 전후가 같은 조건이 아니게 된다. 컴프 안의 메이크업으로 맞춘다.' },
          { text: '메이크업으로 꺼졌을 때와 비슷한 크기로 맞춘 뒤 다시 비교한다', correct: true, feedback: '크기를 맞춰야 처리의 차이만 들린다.' },
        ],
        clue: '메이크업으로 크기를 맞추고 비교',
      },
    ],
    takeaway: '부드럽게 누르고(2:1~4:1, GR 몇 dB), 크기를 맞춰 비교한다.',
  },
  {
    id: 'comp-escape-copied',
    lesson: P5,
    level: 3,
    title: '복사된 컴프 설정',
    scene: '한 봉사자가 "보컬에 잘 맞던 컴프"라며 그 설정을 설교 채널에 그대로 복사했다. 설교가 시작되자 소리가 이상하다.',
    steps: [
      {
        prompt: '설정과 증상을 확인한다.',
        inspect: [
          { label: '컴프 설정', reading: '스레숄드 −40 dB, 레이시오 8:1' },
          { label: 'GR 미터', reading: '평소 말할 때도 −12 dB 근처' },
          { label: '들리는 소리', reading: '숨소리와 방 울림이 커지고 부자연스럽다' },
        ],
        options: [
          { text: '말소리에 너무 세게 걸려 있다', correct: true, feedback: '말소리에 세게 걸면 작은 소리(숨, 방 울림)가 상대적으로 커져 부자연스럽다. 노래보다 가볍게 건다.' },
          { text: '컴프가 너무 약하다', feedback: 'GR −12 dB는 세게 누르는 쪽이다.' },
          { text: '설교 마이크 팬텀 파워 문제다', feedback: '단서는 컴프 설정을 가리킨다.' },
        ],
        clue: '말소리에 너무 세게(GR −12 dB) → 숨·울림이 커짐',
      },
      {
        prompt: '컴프를 만지기 전에 먼저 확인할 것은?',
        options: [
          { text: '설교 채널 게인이 맞게 잡혀 있는지', correct: true, feedback: '게인이 바뀌면 같은 스레숄드라도 눌리는 양이 달라진다. 컴프보다 게인이 먼저다.' },
          { text: '메인 GEQ', feedback: '메인 GEQ는 모든 채널이 섞인 뒤의 소리를 다듬는다. 설교 채널 하나의 설정 문제와 다르다.' },
          { text: '모니터로 보내는 양', feedback: '회중석 소리 문제와 관계없다.' },
        ],
        clue: '컴프 전에 게인 확인',
      },
      {
        prompt: '게인은 맞다. 이제 무엇부터 바꿀까?',
        options: [
          { text: '레이시오를 20:1로 올린다', feedback: '더 세게 누르게 된다.' },
          { text: '레이시오를 2:1~4:1 정도로 낮춘다', correct: true, feedback: '말소리에는 부드러운 레이시오가 무난하다.' },
          { text: '어택을 300 ms로', feedback: '누르는 세기 문제는 그대로다.' },
        ],
        clue: '레이시오를 2:1~4:1로',
      },
      {
        prompt: '스레숄드는 어떻게 맞출까?',
        options: [
          { text: '평소 말에도 GR이 −12 dB 움직이게', feedback: '처음 문제 그대로다.' },
          { text: 'GR이 전혀 안 움직이게', feedback: '그러면 컴프가 하는 일이 없다.' },
          { text: '강조할 때(큰 소리)만 GR이 몇 dB 움직이게 올린다', correct: true, feedback: '큰 소리만 몇 dB 누르는 자리를 찾는다.' },
        ],
        clue: '큰 소리에서만 GR이 몇 dB',
      },
    ],
    takeaway: '설정은 사람과 소리마다 다르다. 게인 → 레이시오 → 스레숄드 순서로 다시 맞춘다.',
  },

  // ---------- 6. 게이트 ----------
  {
    id: 'gate-tom-bleed',
    lesson: P6,
    level: 1,
    title: '쉬고 있는 탐 채널이 움직인다',
    scene: '조용한 곡. 드러머는 쉬고 있는데 탐 마이크 채널 미터가 계속 움직인다. 베이스 앰프와 모니터 소리가 들어오는 것 같다.',
    steps: [
      {
        prompt: '이 현상과 이를 줄이는 장치는?',
        options: [
          { text: '클리핑 → 게인 내리기', feedback: '미터가 빨간 칸까지 가는 문제가 아니다.' },
          { text: '블리드 → 게이트', correct: true, feedback: '다른 소리가 마이크로 새어 드는 것이 블리드다. 게이트는 작은 소리일 때 문을 닫아 줄인다.' },
          { text: '하울링 → GEQ', feedback: '"삐-" 소리가 커지는 고리 현상이 아니다.' },
        ],
        clue: '새어 든 소리 = 블리드 → 게이트',
      },
    ],
    takeaway: '쉬는 동안의 블리드는 게이트로 줄인다.',
  },
  {
    id: 'gate-tune',
    lesson: P6,
    level: 2,
    title: '게이트를 걸었더니 생긴 일',
    scene: '탐 채널에 게이트를 걸었다. 쉬는 동안은 조용해졌는데 새 문제가 생겼다.',
    steps: [
      {
        prompt: '작게 친 탐 소리가 아예 안 들린다. 무엇을 바꿀까?',
        options: [
          { text: '스레숄드를 낮춘다', correct: true, feedback: '스레숄드가 높으면 작은 타격에도 문이 열리지 않는다. 가장 작게 치는 소리에도 열리는 자리로.' },
          { text: '레인지를 키운다', feedback: '닫혔을 때 더 줄일 뿐, 문이 열리는 조건은 그대로다.' },
          { text: '게인을 크게 내린다', feedback: '같은 스레숄드에 더 안 걸려 더 자주 닫힌다.' },
        ],
        clue: '작은 타격이 잘림 → 스레숄드 낮추기',
      },
      {
        prompt: '이번엔 타격 사이가 뚝뚝 끊겨 부자연스럽다. 무엇을 바꿀까?',
        options: [
          { text: '어택을 길게', feedback: '"탁" 하는 첫머리가 뭉개진다. 드럼은 어택을 짧게.' },
          { text: '레인지를 작게(예: 10 dB 안팎)', correct: true, feedback: '완전히 끊지 않고 조금만 줄이면 울림이 살짝 남아 자연스럽다.' },
          { text: '스레숄드를 더 올린다', feedback: '더 자주, 더 많이 끊긴다.' },
        ],
        clue: '뚝뚝 끊김 → 레인지 줄이기',
      },
    ],
    takeaway: '스레숄드는 열리는 조건, 레인지는 닫혔을 때의 양.',
  },
  {
    id: 'gate-escape-sermon',
    lesson: P6,
    level: 3,
    title: '사라지는 설교 끝음절',
    scene: '설교 중 목사님이 작게 말씀하신 문장 끝이 뚝뚝 사라진다는 이야기를 들었다. 지난주에는 없던 일이다.',
    steps: [
      {
        prompt: '설교 채널을 살펴본다.',
        inspect: [
          { label: '게이트', reading: '켜져 있다(스레숄드 −30 dB)' },
          { label: '게인', reading: '어제 다른 봉사자가 6 dB 내렸다' },
          { label: '컴프', reading: '레이시오 3:1, 큰 소리에서 GR 3~4 dB' },
        ],
        options: [
          { text: '게이트가 작은 말소리에서 문을 닫는다', correct: true, feedback: '스레숄드보다 작은 소리가 들어오면 게이트가 닫힌다. 작게 말한 끝음절이 잘리는 전형적인 모습이다.' },
          { text: '컴프가 너무 세다', feedback: 'GR 3~4 dB는 가벼운 편이다. 소리가 사라지게 만들지는 않는다.' },
          { text: '마이크 배터리가 약하다', feedback: '문장 끝만 규칙적으로 사라지는 것은 게이트의 모습이다.' },
        ],
        clue: '끝음절 사라짐 → 게이트가 닫힘',
      },
      {
        prompt: '지난주에는 왜 괜찮았을까?',
        options: [
          { text: '게인이 6 dB 내려가서, 같은 스레숄드에 덜 걸려 문이 더 자주 닫힌다', correct: true, feedback: '게인이 바뀌면 게이트 스레숄드도 다시 잡아야 한다.' },
          { text: '목사님이 이번 주 더 크게 말씀하셨다', feedback: '크게 말하면 문이 덜 닫힌다. 반대다.' },
          { text: '모니터 위치가 바뀌었다', feedback: '게이트가 닫히는 조건과 관계없다.' },
        ],
        clue: '게인을 내린 뒤 스레숄드를 다시 안 잡음',
      },
      {
        prompt: '말소리 채널의 게이트, 어떻게 할까?',
        options: [
          { text: '스레숄드를 더 올린다', feedback: '더 많이 잘린다.' },
          { text: '레인지를 60 dB로 키운다', feedback: '닫힐 때 더 완전히 끊긴다.' },
          { text: '확신이 없으면 끄거나 레인지를 작게 둔다', correct: true, feedback: '말소리 마이크에 게이트는 조심한다. 꼭 필요하지 않으면 끈다.' },
        ],
        clue: '말소리에는 게이트를 끄거나 레인지를 작게',
      },
    ],
    takeaway: '게인을 바꾸면 게이트도 다시. 말소리에는 게이트를 함부로 걸지 않는다.',
  },
];
