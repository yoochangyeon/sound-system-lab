// 실습용 스템 목록. 피크·RMS는 실제 파일에서 미리 계산한 값이다(scripts 없이 #4 작업 때 계산).
// 파일은 public/audio/ 아래에 있고 출처는 public/audio/SOURCES.md에 적는다.

export interface Stem {
  id: string;
  /** 사이트 기준 경로 */
  file: string;
  /** 화면에 보일 악기 이름 */
  label: string;
  /** 무대 박스 단자 이름(쉬운 믹서 입력 고르기). 믹서에 없으면 '—' */
  input: string;
  /** 파일 전체 샘플 피크(dBFS) */
  peakDb: number;
  /** 소리가 나는 구간의 RMS(dBFS) */
  rmsDb: number;
  /** 쉬운 믹서 기본 채널(0부터). 믹서에 없으면 −1 */
  defaultChannel: number;
  /** 설교처럼 말소리인가 */
  speech?: boolean;
}

export { STEMS } from './stems.data';

import { STEMS } from './stems.data';

export function stemById(id: string): Stem | undefined {
  return STEMS.find((s) => s.id === id);
}
