// 실전 시나리오 퀴즈(기획서 S02 '실전 퀴즈', #43). 문제는 데이터로만 추가한다.
// 쉬움 1단계, 보통 2단계, 어려움 3~4단계(방탈출형: 확인할 곳을 열어 단서를 모은 뒤 답을 고른다).

export type QuizLevel = 1 | 2 | 3;

export interface QuizOption {
  text: string;
  correct?: boolean;
  /** 이 보기를 골랐을 때 보여 줄 해설(맞으면 왜 맞는지, 틀리면 왜 아닌지) */
  feedback: string;
}

export interface QuizInspect {
  /** 확인할 곳(예: 입력 미터) */
  label: string;
  /** 열어 보면 보이는 것(예: 말소리에 맞춰 움직인다) */
  reading: string;
}

export interface QuizStep {
  prompt: string;
  /** 방탈출형: 이 타일들을 모두 열어야 보기를 고를 수 있다 */
  inspect?: QuizInspect[];
  options: QuizOption[];
  /** 맞힌 뒤 단서 수첩에 쌓이는 한 줄(사고 흐름 요약에도 쓴다) */
  clue: string;
}

export interface Quiz {
  id: string;
  /** 이 퀴즈가 들어가는 레슨(content id, 예: 01-basics/01-signal-flow) */
  lesson: string;
  level: QuizLevel;
  title: string;
  /** 현장 상황 */
  scene: string;
  /** 말풍선(누가, 무슨 말) */
  who?: string;
  quote?: string;
  steps: QuizStep[];
  /** 다 풀고 보여 주는 한 줄 교훈 */
  takeaway: string;
}
