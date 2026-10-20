// 미션은 데이터다: 상황, 시작 상태, 판정 함수, 힌트, 해설.
// 판정은 상태와 순수 함수만 쓴다(기종과 상관없이 하나).
import type { DeepPartial, MixerState } from '../stores/mixer-model';

export interface MissionResult {
  passed: boolean;
  /** 진행 상황을 보여 줄 짧은 줄들(선택) */
  checks?: { label: string; ok: boolean }[];
}

export interface Mission {
  id: string;
  title: string;
  /** 현장 상황 설명 */
  situation: string;
  /** 이 미션에서 주로 볼 채널(콘솔이 시작할 때 선택한다) */
  focusChannel: number;
  /** 콘솔 기본 상태에 덮어쓸 부분 */
  initial: DeepPartial<MixerState>;
  /** 판정: 지금 상태와 미션 시작 상태를 받는다 */
  judge: (s: MixerState, start: MixerState) => MissionResult;
  /** 2~3단계. 갈수록 구체적이다 */
  hints: string[];
  /** 성공 뒤 보여 주는 '왜 이게 답인가' */
  explanation: string;
  /** 정답 조작(테스트가 모든 기종 프로필에서 풀리는지 확인한다) */
  solve: (a: import('../stores/mixer').MixerActions, s: MixerState) => void;
  /** 함정 조작들: 하면 안 되는 방법. 테스트가 실패하는지 확인한다 */
  traps?: { label: string; apply: (a: import('../stores/mixer').MixerActions, s: MixerState) => void }[];
}
