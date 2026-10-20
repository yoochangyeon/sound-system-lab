// 미션 카드(기획서 S06): 믹서 맨 위. 미션 고르기 → 상황 → 실시간 체크리스트 → 힌트 → 성공·해설 → 다음 미션.
// 완료 기록은 저장하지 않는다.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { Mission } from '../missions/types';
import { snapshot, type MixerStoreApi } from '../stores/mixer';
import type { MixerState } from '../stores/mixer-model';

export interface MissionCardProps {
  store: MixerStoreApi;
  /** 지금 곡에서 풀 수 있는 미션 */
  missions: Mission[];
  missionId: string | null;
  onChange: (id: string | null) => void;
  onFocusChannel: (ch: number) => void;
  /** 미션이 전체 보기를 필요로 하면 연다 */
  onNeedFull?: () => void;
}

export function MissionCard({ store, missions: MISSIONS, missionId, onChange, onFocusChannel, onNeedFull }: MissionCardProps) {
  const mission = useMemo(() => MISSIONS.find((m) => m.id === missionId) ?? null, [MISSIONS, missionId]);
  const [hintsShown, setHintsShown] = useState(0);
  const [succeeded, setSucceeded] = useState(false);
  const start = useRef<MixerState | null>(null);
  const chips = useRef<HTMLDivElement>(null);
  // 상태가 바뀔 때마다 다시 판정한다.
  useStore(store, (s) => s);

  // 고른 미션 칩이 보이게 가로 스크롤한다.
  useEffect(() => {
    const el = chips.current?.querySelector<HTMLElement>('.is-active');
    if (el && chips.current) chips.current.scrollTo({ left: el.offsetLeft - 8, behavior: 'smooth' });
  }, [missionId]);

  useEffect(() => {
    const a = store.getState().actions;
    setHintsShown(0);
    setSucceeded(false);
    if (!mission) {
      a.reset();
      start.current = null;
      return;
    }
    a.reset();
    a.apply(mission.initial);
    start.current = snapshot(store);
    onFocusChannel(mission.focusChannel);
    if (mission.view === 'full') onNeedFull?.();
  }, [mission, store]);

  const result = mission && start.current ? mission.judge(snapshot(store), start.current) : null;
  useEffect(() => {
    if (result?.passed) setSucceeded(true);
  }, [result?.passed]);

  const restart = () => {
    const a = store.getState().actions;
    a.reset();
    if (mission) {
      a.apply(mission.initial);
      start.current = snapshot(store);
      onFocusChannel(mission.focusChannel);
    }
    setHintsShown(0);
    setSucceeded(false);
  };

  const idx = mission ? MISSIONS.indexOf(mission) : -1;
  const next: Mission | undefined = idx >= 0 ? MISSIONS[idx + 1] : MISSIONS[0];
  const done = result?.checks?.filter((c) => c.ok).length ?? 0;
  const total = result?.checks?.length ?? 0;

  return (
    <section className={`mx-card mx-mission${succeeded ? ' is-done' : ''}`} aria-label="미션">
      <div className="sim-chips" role="radiogroup" aria-label="미션 고르기" ref={chips}>
        <button type="button" role="radio" aria-checked={!mission} className={`sim-chip${!mission ? ' is-active' : ''}`} onClick={() => onChange(null)}>
          자유 모드
        </button>
        {MISSIONS.map((m, i) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={missionId === m.id}
            className={`sim-chip${missionId === m.id ? ' is-active' : ''}`}
            onClick={() => onChange(m.id)}
          >
            {i + 1}. {m.title}
          </button>
        ))}
      </div>

      {!mission && (
        <div className="mx-mission-body">
          <h2>자유 모드</h2>
          <p>찬양팀 기본 믹스가 걸려 있다. 마음껏 만져 본다. 위에서 미션을 고르면 문제가 있는 상태로 바뀌고, 고치는 동안 바로 판정한다.</p>
          <button type="button" className="sim-btn is-primary mx-wide" onClick={() => onChange(MISSIONS[0].id)}>
            첫 미션 시작: {MISSIONS[0].title}
          </button>
        </div>
      )}

      {mission && (
        <div className="mx-mission-body">
          <div className="mx-mission-head">
            <span className={`mx-badge${succeeded ? ' is-done' : ''}`} role="status" aria-live="polite">
              {succeeded ? '성공' : `진행 중 ${done}/${total}`}
            </span>
            <button type="button" className="sim-btn is-small" onClick={restart}>
              처음 상태로
            </button>
          </div>
          <h2>{mission.title}</h2>
          <p>{mission.situation}</p>

          {result?.checks && (
            <ul className="mx-checks">
              {result.checks.map((c, i) => (
                <li key={i} className={c.ok ? 'is-ok' : ''}>
                  <span aria-hidden="true">{c.ok ? '✓' : ''}</span>
                  {c.label}
                </li>
              ))}
            </ul>
          )}

          {!succeeded && (
            <div className="mx-hints">
              {mission.hints.slice(0, hintsShown).map((h, i) => (
                <p key={i} className="mx-hint">
                  <strong>힌트 {i + 1}</strong>
                  {h}
                </p>
              ))}
              {hintsShown < mission.hints.length && (
                <button type="button" className="sim-btn mx-wide" onClick={() => setHintsShown((n) => n + 1)}>
                  힌트 {hintsShown + 1} 보기
                </button>
              )}
            </div>
          )}

          {succeeded && (
            <div className="mx-explain">
              <h3>왜 이게 답일까</h3>
              <p>{mission.explanation}</p>
              {next ? (
                <button type="button" className="sim-btn is-primary mx-wide" onClick={() => onChange(next.id)}>
                  다음 미션: {next.title}
                </button>
              ) : (
                <button type="button" className="sim-btn mx-wide" onClick={() => onChange(null)}>
                  모든 미션 끝 · 자유 모드로
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
