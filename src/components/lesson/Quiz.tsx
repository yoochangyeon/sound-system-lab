// O/X 퀴즈(기획서 S02). 답을 누르면 바로 정답과 한 줄 해설. 기록하지 않는다.
import { useState } from 'react';
import './quiz.css';

export interface QuizProps {
  q: string;
  /** 정답이 O면 true */
  answer: boolean;
  explain: string;
}

export default function Quiz({ q, answer, explain }: QuizProps) {
  const [picked, setPicked] = useState<boolean | null>(null);
  const done = picked !== null;
  const right = picked === answer;
  return (
    <div className={`quiz${done ? (right ? ' is-right' : ' is-wrong') : ''}`}>
      <span className="quiz-tag">O/X 퀴즈</span>
      <p className="quiz-q">{q}</p>
      <div className="quiz-btns">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            className={`quiz-btn${picked === v ? ' is-picked' : ''}${done && v === answer ? ' is-answer' : ''}`}
            onClick={() => setPicked(v)}
            aria-pressed={picked === v}
          >
            {v ? 'O' : 'X'}
          </button>
        ))}
      </div>
      {done && (
        <div className="quiz-result" role="status">
          <strong>{right ? '정답이에요' : `아쉬워요. 정답은 ${answer ? 'O' : 'X'}`}</strong>
          <p>{explain}</p>
        </div>
      )}
    </div>
  );
}
