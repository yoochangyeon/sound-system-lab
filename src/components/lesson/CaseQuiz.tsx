// 실전 시나리오 퀴즈(기획서 S02 '실전 퀴즈', #43).
// 단계마다: (방탈출형이면) 확인할 곳을 하나씩 열어 단서를 모은다 → 보기를 고른다 → 틀리면 왜 아닌지 보고 다시 →
// 맞히면 단서가 수첩에 쌓이고 다음 단계. 다 풀면 사고 흐름과 교훈. 기록은 남기지 않는다.
import { useState } from 'react';
import { quizById } from '../../quizzes';
import './case-quiz.css';

const LEVEL = { 1: '쉬움', 2: '보통', 3: '어려움' } as const;
const MARK = ['가', '나', '다', '라', '마'];

export default function CaseQuiz({ id }: { id: string }) {
  const quiz = quizById(id);
  const [step, setStep] = useState(0);
  const [opened, setOpened] = useState<number[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [wrong, setWrong] = useState<number[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [done, setDone] = useState(false);

  if (!quiz) return <p className="cq-missing">퀴즈를 찾지 못했습니다: {id}</p>;

  const s = quiz.steps[step];
  const total = quiz.steps.length;
  const escape = quiz.level === 3;
  const needOpen = s.inspect?.length ?? 0;
  const allOpen = opened.length >= needOpen;
  const solved = picked !== null && !!s.options[picked]?.correct;
  const clues = quiz.steps.slice(0, solved ? step + 1 : step).map((x) => x.clue);

  const choose = (i: number) => {
    if (solved) return;
    setPicked(i);
    if (!s.options[i].correct && !wrong.includes(i)) {
      setWrong([...wrong, i]);
      setMistakes((m) => m + 1);
    }
  };
  const next = () => {
    if (step + 1 >= total) return setDone(true);
    setStep(step + 1);
    setOpened([]);
    setPicked(null);
    setWrong([]);
  };
  const restart = () => {
    setStep(0);
    setOpened([]);
    setPicked(null);
    setWrong([]);
    setMistakes(0);
    setDone(false);
  };

  return (
    <div className={`cq is-lv${quiz.level}${done ? ' is-done' : ''}`}>
      <div className="cq-head">
        <span className="cq-level">
          {LEVEL[quiz.level]}
          {escape ? ' · 방탈출' : ''}
        </span>
        {!done && total > 1 && (
          <span className="cq-progress" aria-label={`단계 ${step + 1} / ${total}`}>
            {quiz.steps.map((_, i) => (
              <i key={i} className={i < step || (i === step && solved) ? 'is-on' : i === step ? 'is-now' : ''} />
            ))}
          </span>
        )}
      </div>
      <h3 className="cq-title">{quiz.title}</h3>
      <p className="cq-scene">{quiz.scene}</p>
      {quiz.quote && (
        <div className="cq-quote">
          {quiz.who && <small>{quiz.who}</small>}
          <span>{quiz.quote}</span>
        </div>
      )}

      {clues.length > 0 && !done && (
        <div className="cq-notebook">
          <b>단서 수첩</b>
          <ol>
            {clues.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ol>
        </div>
      )}

      {!done && (
        <div className="cq-step">
          {total > 1 && <span className="cq-stepno">단계 {step + 1}</span>}
          <p className="cq-prompt">{s.prompt}</p>

          {s.inspect && (
            <>
              <div className="cq-inspect">
                {s.inspect.map((t, i) => {
                  const on = opened.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`cq-tile${on ? ' is-open' : ''}`}
                      aria-expanded={on}
                      onClick={() => !on && setOpened([...opened, i])}
                    >
                      <span className="cq-tile-label">
                        <span aria-hidden="true">{on ? '🔍' : '🔒'}</span> {t.label}
                      </span>
                      {on ? <span className="cq-tile-reading">{t.reading}</span> : <span className="cq-tile-hint">눌러서 확인</span>}
                    </button>
                  );
                })}
              </div>
              {!allOpen && (
                <p className="cq-wait">
                  확인할 곳을 모두 열면 답을 고를 수 있어요 ({opened.length}/{needOpen})
                </p>
              )}
            </>
          )}

          {allOpen && (
            <div className="cq-options" role="group" aria-label="보기">
              {s.options.map((o, i) => {
                const isWrong = wrong.includes(i);
                const isRight = solved && picked === i;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`cq-opt${isWrong ? ' is-wrong' : ''}${isRight ? ' is-right' : ''}`}
                    onClick={() => choose(i)}
                    disabled={solved && !isRight}
                  >
                    <span className="cq-mark">{MARK[i]}</span>
                    <span>{o.text}</span>
                  </button>
                );
              })}
            </div>
          )}

          {picked !== null && (
            <div className={`cq-feedback${solved ? ' is-right' : ' is-wrong'}`} role="status" aria-live="polite">
              <strong>{solved ? '맞아요' : '다시 생각해 봐요'}</strong>
              <p>{s.options[picked].feedback}</p>
            </div>
          )}

          {solved && (
            <button type="button" className="cq-next" onClick={next}>
              {step + 1 >= total ? '결과 보기' : '다음 단계'}
            </button>
          )}
        </div>
      )}

      {done && (
        <div className="cq-result">
          <div className="cq-result-head">
            <strong>{escape ? '탈출 성공!' : '해결!'}</strong>
            <span>{mistakes === 0 ? '한 번도 틀리지 않았어요' : `틀린 횟수 ${mistakes}번`}</span>
          </div>
          <b className="cq-flow-title">사고 흐름</b>
          <ol className="cq-flow">
            {quiz.steps.map((x, i) => (
              <li key={i}>{x.clue}</li>
            ))}
          </ol>
          <p className="cq-takeaway">{quiz.takeaway}</p>
          <button type="button" className="cq-again" onClick={restart}>
            처음부터 다시 풀기
          </button>
        </div>
      )}
    </div>
  );
}
