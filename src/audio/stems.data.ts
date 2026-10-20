import type { Stem } from './stems';

// 밴드: ccMixter tmray "Forget It - Demo"(CC BY 3.0)의 60~108초 구간(80 BPM, 16마디)을 모노 AAC 96 kbps로 자른 것.
// 피크·RMS는 자르고 페이드한 원본 PCM에서 계산했다(RMS는 −60 dBFS 이상인 50 ms 구간들의 평균). 2026-10-20.
// 설교: 운영자 녹음(#5)이 들어올 때까지 보컬 음원을 임시로 쓴다(placeholder). 녹음이 오면 #19에서 바꾼다.
export const STEMS: Stem[] = [
  { id: 'vocals', file: '/audio/band/vocals.m4a', label: '보컬', input: 'IN 1', peakDb: -10.7, rmsDb: -21.8, defaultChannel: 0 },
  {
    id: 'sermon',
    file: '/audio/band/vocals.m4a',
    label: '설교(임시 음원)',
    input: 'IN 2',
    peakDb: -10.7,
    rmsDb: -21.8,
    defaultChannel: 1,
    speech: true,
  },
  { id: 'drums', file: '/audio/band/drums.m4a', label: '드럼', input: 'IN 3', peakDb: -6.7, rmsDb: -17.5, defaultChannel: 2 },
  { id: 'percussion', file: '/audio/band/percussion.m4a', label: '퍼커션', input: 'IN 4', peakDb: -16.4, rmsDb: -29.2, defaultChannel: 3 },
  { id: 'shaker', file: '/audio/band/shaker.m4a', label: '셰이커', input: 'IN 5', peakDb: -29.9, rmsDb: -43.4, defaultChannel: 4 },
  { id: 'bass', file: '/audio/band/bass.m4a', label: '베이스', input: 'IN 6', peakDb: -9.7, rmsDb: -20.1, defaultChannel: 5 },
  { id: 'guitar-main', file: '/audio/band/guitar-main.m4a', label: '일렉 기타', input: 'IN 7', peakDb: -5.3, rmsDb: -20.2, defaultChannel: 6 },
  { id: 'guitar-verse', file: '/audio/band/guitar-verse.m4a', label: '기타(벌스)', input: 'IN 8', peakDb: -20.1, rmsDb: -36.4, defaultChannel: 7 },
  { id: 'guitar-plucks', file: '/audio/band/guitar-plucks.m4a', label: '기타(피킹)', input: 'IN 9', peakDb: -19.5, rmsDb: -34.2, defaultChannel: 8 },
  { id: 'sax-guitar', file: '/audio/band/sax-guitar.m4a', label: '색소폰·기타', input: 'IN 10', peakDb: -8.2, rmsDb: -17.6, defaultChannel: 9 },
  { id: 'organ', file: '/audio/band/organ.m4a', label: '오르간', input: 'IN 11', peakDb: -17.6, rmsDb: -30.4, defaultChannel: 10 },
  { id: 'keys', file: '/audio/band/keys.m4a', label: '건반', input: 'IN 12', peakDb: -41.7, rmsDb: -50.1, defaultChannel: 11 },
];

export const LOOP_SECONDS = 48;
