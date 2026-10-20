// 4차 확장 실전 퀴즈. 수치와 사실은 해당 레슨 원고(출처 주석 포함)를 벗어나지 않는다.
import type { Quiz } from './types';

const RD = '02-processing/07-reverb-delay';
const IS = '02-processing/08-insert-send';

export const FX: Quiz[] = [
  // ---------- 7. 리버브·딜레이 ----------
  {
    id: 'fx-dry-vocal-easy',
    lesson: RD,
    level: 1,
    title: '목소리가 너무 말랐어요',
    scene: '주일 아침 리허설. 리드 보컬은 FX 버스의 리버브로 보내는 양이 −∞(보내지 않음)로 되어 있다.',
    who: '찬양 인도자',
    quote: '제 목소리가 너무 말라서 들려요. 울림 좀 넣어 주세요.',
    steps: [
      {
        prompt: '가장 먼저 할 일은?',
        options: [
          { text: '리드 보컬 페이더를 크게 올린다', feedback: '크기만 커질 뿐 울림은 생기지 않는다.' },
          { text: '잔향 길이를 끝까지 늘린다', feedback: '아직 리버브로 보내는 소리가 없다. 보내지 않으면 잔향도 없다. 길게 늘리면 가사도 묻힌다.' },
          { text: '리드 보컬에서 리버브로 보내는 양을 조금씩 올린다', correct: true, feedback: '복사본을 리버브로 보내야 잔향이 돌아온다. 가사가 흐려지기 직전까지만 조금씩 올린다.' },
        ],
        clue: '울림이 없다 → 리버브로 보내는 양부터 조금씩',
      },
    ],
    takeaway: '리버브는 보내야 돌아온다. 보내는 양부터 조금씩.',
  },
  {
    id: 'fx-delay-tempo',
    lesson: RD,
    level: 2,
    title: '메아리를 박자에 맞추기',
    scene: '이번 주 찬양곡은 120 BPM이다. 인도자가 후렴 끝 음에만 메아리를 살짝 넣어 달라고 했다.',
    steps: [
      {
        prompt: '한 박(4분음표)에 맞춘 딜레이 시간은?',
        options: [
          { text: '500 ms', correct: true, feedback: '60000 ÷ 120 = 500 ms. 한 박의 길이다.' },
          { text: '120 ms', feedback: 'BPM 숫자를 그대로 쓰면 안 된다. 60000 ÷ BPM으로 계산한다.' },
          { text: '2000 ms', feedback: '2000 ms는 2초다. 60000 ÷ 120으로 계산하면 한 박은 그보다 훨씬 짧다.' },
        ],
        clue: '120 BPM 한 박 = 60000 ÷ 120 = 500 ms',
      },
      {
        prompt: '4분은 너무 느리게 들린다. 점8분으로 바꾸면?',
        options: [
          { text: '250 ms', feedback: '500 × ½은 8분이다. 점8분은 한 박의 ¾이다.' },
          { text: '375 ms', correct: true, feedback: '500 × ¾ = 375 ms. 박 사이로 메아리가 숨는다.' },
          { text: '750 ms', feedback: '500 × 1.5다. 한 박보다 길어 더 느려진다.' },
        ],
        clue: '점8분 = 한 박 × ¾ = 375 ms',
      },
    ],
    takeaway: '딜레이 시간 = 60000 ÷ BPM × 박자. 박자에 맞추면 메아리가 덜 지저분하다.',
  },
  {
    id: 'fx-escape-sermon-wash',
    lesson: RD,
    level: 3,
    title: '설교가 동굴에서 들린다',
    scene: '찬양이 끝나고 설교가 시작됐다. 말씀이 웅웅 울려 단어가 잘 안 들린다는 쪽지가 방송실로 왔다. 확인할 곳을 하나씩 열어 보자.',
    steps: [
      {
        prompt: '설교 채널부터 확인한다. 울림의 원인은?',
        inspect: [
          { label: '설교 채널 · 센드 탭', reading: '리버브로 보내는 양 −5 dB. 찬양 때 써 둔 값 그대로다' },
          { label: '설교 채널 · HPF', reading: '켜짐. 100 Hz 근처' },
          { label: 'FX 리턴', reading: '켜짐. 찬양 보컬 잔향도 여기로 돌아온다' },
        ],
        options: [
          { text: 'HPF가 너무 낮다', feedback: 'HPF는 낮은 웅웅거림을 깎는 필터다. 문제는 말 뒤에 남는 잔향이다.' },
          { text: '설교 채널에 리버브 센드가 남아 있다', correct: true, feedback: '설교는 리버브를 보통 넣지 않거나 아주 조금만 쓴다. 찬양 때 값이 그대로 남았다.' },
          { text: 'FX 리턴이 켜져 있는 것 자체가 문제다', feedback: '리턴은 찬양 보컬도 함께 쓰는 길이다. 문제는 설교 채널이 그쪽으로 보내고 있다는 점이다.' },
        ],
        clue: '설교 채널에 찬양용 리버브 센드가 남음',
      },
      {
        prompt: '가장 알맞은 조치는?',
        inspect: [{ label: '다음 순서', reading: '설교가 끝나면 바로 찬양이 이어진다' }],
        options: [
          { text: '설교 채널의 리버브 보내는 양을 내린다', correct: true, feedback: '설교 채널만 잔향에서 빼면 된다. 찬양 보컬의 잔향 설정은 그대로 남는다.' },
          { text: '설교 페이더를 올려 울림보다 크게 만든다', feedback: 'FX 센드는 보통 페이더 뒤라서, 페이더를 올리면 잔향도 같이 커진다.' },
          { text: '잔향 길이를 0.2초로 줄인다', feedback: '찬양 보컬의 잔향까지 바뀐다. 바로 이어질 찬양이 말라 버린다.' },
        ],
        clue: '설교 채널 센드만 내린다. 찬양 설정은 지킨다',
      },
      {
        prompt: '설교 뒤 찬양. 이번엔 보컬 가사가 뭉개진다. 리버브를 연다.',
        inspect: [
          { label: '잔향 길이', reading: '4.5초' },
          { label: '예배당', reading: '빈 예배당에서 손뼉을 치면 울림이 한참 남는다' },
          { label: '보컬 센드', reading: '−10 dB 근처. 크지 않다' },
        ],
        options: [
          { text: '보컬 EQ에서 고음을 크게 올린다', feedback: '가사가 묻히는 원인은 긴 잔향이다. 고음을 올리면 쏘기만 한다.' },
          { text: '보내는 양을 더 올려 울림을 키운다', feedback: '잔향이 길수록 앞 음절이 다음 음절을 덮는다. 더 뭉개진다.' },
          { text: '잔향 길이를 줄인다', correct: true, feedback: '방이 이미 울린다. 그 위에 긴 잔향이 얹혀 다음 음절을 덮었다. 라이브에서는 짧게 쓴다.' },
        ],
        clue: '방이 이미 울림 + 잔향 4.5초 → 잔향 길이를 줄인다',
      },
      {
        prompt: '잔향을 줄였다. 단어 첫머리를 조금 더 또렷하게 하려면?',
        inspect: [{ label: '프리딜레이', reading: '0 ms' }],
        options: [
          { text: '프리딜레이를 20~30 ms쯤 준다', correct: true, feedback: '원음과 잔향 사이에 틈이 생겨 단어 첫머리가 먼저 들린다.' },
          { text: '하이컷을 끝까지 올린다', feedback: '하이컷은 잔향의 고음을 다듬는다. 첫머리를 지키는 손잡이는 프리딜레이다.' },
          { text: '딜레이 피드백을 올린다', feedback: '메아리가 늘어 오히려 더 어수선해진다.' },
        ],
        clue: '프리딜레이 20~30 ms로 첫머리를 지킨다',
      },
    ],
    takeaway: '울림이 문제면 누가 보내는지(센드), 얼마나 긴지(잔향 길이), 틈이 있는지(프리딜레이) 차례로 본다.',
  },

  // ---------- 8. Insert와 Send ----------
  {
    id: 'fx-shared-reverb',
    lesson: IS,
    level: 1,
    title: '보컬 넷에 같은 울림',
    scene: '찬양팀 보컬 네 명 모두에게 같은 리버브를 주고 싶다. 넷의 울림을 한 번에 키우고 줄일 수 있으면 좋겠다.',
    steps: [
      {
        prompt: '어떻게 걸까?',
        options: [
          { text: '채널마다 Insert로 리버브를 하나씩 끼운다', feedback: '이펙트가 네 개 필요하고, 넷의 울림을 따로따로 맞춰야 한다.' },
          { text: '네 채널을 FX 버스로 보내고, 리버브 하나의 리턴을 섞는다', correct: true, feedback: 'Send/Return이다. 리버브 하나를 나눠 쓰고, 리턴 페이더로 잔향 전체 크기를 한 번에 정한다.' },
          { text: '메인 버스에 리버브를 Insert로 끼운다', feedback: '메인의 모든 소리, 설교까지 리버브를 지나간다.' },
        ],
        clue: '여러 채널이 같은 이펙트 → Send/Return',
      },
    ],
    takeaway: '여럿이 같이 쓰는 이펙트는 보내고 돌려받는다.',
  },
  {
    id: 'fx-ghost-reverb',
    lesson: IS,
    level: 2,
    title: '페이더를 내렸는데 울림만 남았다',
    scene: '찬양 중 코러스 보컬 한 명이 쉬는 구간이라 그 채널 페이더를 끝까지 내렸다. 그런데 그 마이크로 들어온 소리의 잔향이 계속 들린다.',
    steps: [
      {
        prompt: '원인은?',
        options: [
          { text: '리턴 페이더가 너무 높다', feedback: '리턴은 모든 채널의 잔향 크기다. 이 채널만 페이더를 따르지 않는 이유는 센드 위치에 있다.' },
          { text: '이 채널의 리버브 센드가 페이더 앞(pre)이다', correct: true, feedback: '페이더 앞 센드는 채널 페이더의 영향을 받지 않는다. 원음은 사라져도 잔향은 남는다.' },
          { text: 'Insert Mix가 100%다', feedback: 'Insert는 페이더 앞에 끼워져 있어 페이더를 내리면 같이 줄어든다.' },
        ],
        clue: '페이더를 내려도 잔향이 남음 → 센드가 페이더 앞(pre)',
      },
      {
        prompt: '센드 위치를 어디로 바꿀까?',
        options: [
          { text: '그대로 페이더 앞(pre)', feedback: '같은 일이 또 생긴다. 페이더 앞은 모니터 센드에 많이 쓴다.' },
          { text: '센드는 두고 리턴 페이더를 내린다', feedback: '리턴은 모든 채널의 잔향 크기다. 다른 보컬의 잔향까지 줄어든다.' },
          { text: '페이더 뒤(post)', correct: true, feedback: 'FX 센드는 보통 페이더 뒤다. 페이더를 내리면 잔향도 같이 줄어 비율이 유지된다.' },
        ],
        clue: 'FX 센드는 페이더 뒤(post)',
      },
    ],
    takeaway: 'FX 센드는 페이더 뒤. 그래야 원음과 잔향이 같이 움직인다.',
  },
  {
    id: 'fx-escape-handover',
    lesson: IS,
    level: 3,
    title: '인수인계받은 이펙트 정리',
    scene: '방송실을 새로 맡았다. 콘솔은 X32 계열이다. 다른 보컬들은 FX 버스의 리버브 하나를 같이 쓰는데, 리드 보컬만 멀리서 웅웅거리듯 들린다. 확인할 곳을 하나씩 열어 보자.',
    steps: [
      {
        prompt: '리드 보컬 채널을 연다. 왜 멀리서 들릴까?',
        inspect: [
          { label: '리드 보컬 · 인서트', reading: '리버브 켜짐, Mix 100%' },
          { label: '리드 보컬 · 센드', reading: 'FX 버스로 보내는 양 −∞(보내지 않음)' },
        ],
        options: [
          { text: '인서트 리버브의 Mix가 100%라 원음이 거의 없다', correct: true, feedback: 'Insert의 Mix는 높일수록 원음이 줄어든다. 100%면 이펙트 소리만 남는다.' },
          { text: 'FX 버스로 보내는 양이 너무 크다', feedback: '센드는 −∞로 보내지 않고 있다.' },
          { text: '리턴이 꺼져 있다', feedback: '리드 보컬은 지금 센드를 쓰지 않는다. 원인은 채널에 끼운 Insert다.' },
        ],
        clue: '인서트 리버브 Mix 100% → 원음이 사라짐',
      },
      {
        prompt: '다른 보컬과 같은 울림으로 맞추려면?',
        options: [
          { text: '인서트 Mix를 0%로 내린다', feedback: '원음은 돌아오지만 울림이 하나도 없다. 다른 보컬과 같은 울림이 아니다.' },
          { text: '인서트 리버브를 끄고, 센드로 FX 버스에 보낸다', correct: true, feedback: '같은 리버브를 나눠 쓰면 넷의 울림이 같고 원음도 그대로다.' },
          { text: '인서트 리버브를 그대로 두고 센드도 올린다', feedback: '원음이 없는 채로 잔향만 두 겹이 된다.' },
        ],
        clue: '인서트 끄고 센드로 → 같은 리버브를 나눠 쓴다',
      },
      {
        prompt: '콘솔의 FX 화면을 연다. 이 리버브를 센드로 쓸 수 있을까?',
        inspect: [
          { label: 'FX 슬롯 7', reading: '리버브가 들어 있다' },
          { label: 'FX 슬롯 3', reading: '비어 있다' },
        ],
        options: [
          { text: '슬롯 7 그대로 센드로 쓴다', feedback: 'X32 계열에서 FX 5~8은 인서트로만 쓴다.' },
          { text: '슬롯 7을 채널 인서트로 끼우고 Mix를 낮춘다', feedback: '다시 채널마다 하나씩 거는 방식이 된다. 나눠 쓰려면 센드가 되는 슬롯이 필요하다.' },
          { text: '리버브를 센드가 되는 슬롯(1~4)인 3번에 넣는다', correct: true, feedback: 'X32 계열에서 FX 1~4는 센드와 인서트 둘 다 된다. 3번이면 센드로 쓸 수 있다.' },
        ],
        clue: 'X32 계열: 센드는 FX 1~4',
      },
      {
        prompt: '마지막으로 리드 보컬의 새 센드를 확인한다.',
        inspect: [
          { label: '센드 위치', reading: '페이더 앞(pre)' },
          { label: '전임자 메모', reading: '"기도 시간에 리드 보컬 페이더를 내려도 울림이 남음"' },
        ],
        options: [
          { text: '센드를 페이더 뒤(post)로 바꾼다', correct: true, feedback: '페이더를 내리면 잔향도 같이 준다. FX 센드는 보통 페이더 뒤다.' },
          { text: '리턴 페이더를 내린다', feedback: '다른 보컬의 잔향까지 줄어든다. 이 채널의 센드 위치가 문제다.' },
          { text: '인서트를 다시 켠다', feedback: '처음 문제로 돌아간다.' },
        ],
        clue: 'FX 센드는 페이더 뒤(post)',
      },
    ],
    takeaway: '나눠 쓰는 리버브는 센드로, 센드는 페이더 뒤로. 채널 하나만 다듬는 처리기만 Insert에 둔다.',
  },
];
