// 음원 라이브러리(기획서 9장 '음원 라이브러리', #45).
// 곡 하나 = 매니페스트 하나. 실습은 곡을 고르고, 그 곡에서 역할에 맞는 소스를 고른다.

export type StemRole =
  | 'kick'
  | 'snare'
  | 'toms'
  | 'overheads'
  | 'percussion'
  | 'bass'
  | 'guitar'
  | 'keys'
  | 'lead-vocal'
  | 'backing-vocal'
  | 'speech';

export const ROLE_LABEL: Record<StemRole, string> = {
  kick: '킥',
  snare: '스네어',
  toms: '탐',
  overheads: '오버헤드',
  percussion: '퍼커션',
  bass: '베이스',
  guitar: '기타',
  keys: '건반',
  'lead-vocal': '리드 보컬',
  'backing-vocal': '백킹 보컬',
  speech: '말소리',
};

export interface SongStem {
  /** 곡 안에서의 키(파일 이름과 같다) */
  key: string;
  label: string;
  role: StemRole;
  /** 사이트 기준 경로 */
  file: string;
  /** 파일 전체 샘플 피크(dBFS) */
  peakDb: number;
  /** 소리가 나는 구간(50 ms, −60 dBFS 이상)의 RMS(dBFS) */
  rmsDb: number;
  /** 원본 트랙과 묶은 방법 등(출처 페이지에 보인다) */
  from: string;
}

export interface MixerSlot {
  stem: string;
  faderDb: number;
  /** 모니터 1(보컬)·모니터 2(밴드)로 보내는 양 */
  sends: [number, number];
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  genre: string;
  bpm: number;
  /** 루프 길이(초). 모든 소스 파일의 길이와 같다 */
  loopSeconds: number;
  /** 원곡에서 자른 구간 */
  excerpt: { fromSec: number; toSec: number; bars: number; note: string };
  source: { name: string; url: string };
  terms: { summary: string; url: string; checked: string; caution?: string };
  /** 바꾼 점(출처 표기용) */
  changes: string;
  stems: SongStem[];
  /** 원곡 완성 믹스(정답 믹스). 스테레오 */
  reference?: { file: string; peakDb: number; rmsDb: number; note: string };
  /** 쉬운 믹서 기본 채널 배치(8개) */
  mixer: MixerSlot[];
}
