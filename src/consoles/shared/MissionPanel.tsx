// 미션 패널(기획서 S06): 콘솔 오른쪽에 붙는다. 목록 → 상황 → 실시간 판정 → 성공 → 해설 → 다음 미션.
// 완료 기록은 저장하지 않는다.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { MISSIONS } from '../../missions';
import type { Mission } from '../../missions/types';
import { snapshot, type MixerStoreApi } from '../../stores/mixer';
import type { MixerState } from '../../stores/mixer-model';

export interface MissionPanelProps {
  store: MixerStoreApi;
  missionId: string | null;
  onChange: (id: string | null) => void;
  onFocusChannel: (ch: number) => void;
}

export function MissionPanel({ store, missionId, onChange, onFocusChannel }: MissionPanelProps) {
  const mission = useMemo(() => MISSIONS.find((m) => m.id === missionId) ?? null, [missionId]);
  const [hintsShown, setHintsShown] = useState(0);
  const [succeeded, setSucceeded] = useState(false);
  const start = useRef<MixerState | null>(null);
  const state = useStore(store, (s) => s);

  // 미션을 고르면 시작 상태를 적용한다.
  useEffect(() => {
    const a = store.getState().actions;
    setHintsShown(0);
    setSucceeded(false);
    if (!mission) {
      a.reset();
      start.current = null;
      return;
    }
    a.apply(mission.initial);
    start.current = snapshot(store);
    onFocusChannel(mission.focusChannel);
  }, [mission, store]);

  const result = mission && start.current ? mission.judge(snapshot(store), start.current) : null;
  useEffect(() => {
    if (result?.passed) setSucceeded(true);
  }, [result?.passed]);
  void state;

  const restart = () => {
    if (!mission) return store.getState().actions.reset();
    store.getState().actions.apply(mission.initial);
    start.current = snapshot(store);
    setHintsShown(0);
    setSucceeded(false);
  };

  const idx = mission ? MISSIONS.indexOf(mission) : -1;
  const next: Mission | undefined = idx >= 0 ? MISSIONS[idx + 1] : MISSIONS[0];

  return (
    <aside className="con-mission" aria-label="미션">
      <div className="con-mission-head">
        <label className="sim-select">
          <span>미션</span>
          <select value={missionId ?? ''} onChange={(e) => onChange(e.target.value || null)}>
            <option value="">자유 모드(미션 없음)</option>
            {MISSIONS.map((m, i) => (
              <option key={m.id} value={m.id}>
                {i + 1}. {m.title}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="sim-btn is-small" onClick={restart}>
          처음 상태로
        </button>
      </div>

      {!mission && (
        <div className="con-mission-body">
          <p>지금은 자유 모드다. 기본 믹스에서 마음껏 만져 본다.</p>
          <p className="sim-stat">미션을 고르면 문제가 있는 상태로 바뀌고, 고치는 동안 실시간으로 판정한다.</p>
          <ol className="con-mission-list">
            {MISSIONS.map((m) => (
              <li key={m.id}>
                <button type="button" className="con-linkish" onClick={() => onChange(m.id)}>
                  {m.title}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {mission && (
        <div className="con-mission-body">
          <h3>{mission.title}</h3>
          <p>{mission.situation}</p>
          <div className={`con-mission-status${succeeded ? ' is-done' : ''}`} role="status" aria-live="polite">
            {succeeded ? '✔ 성공!' : '진행 중'}
          </div>
          {result?.checks && (
            <ul className="con-checks">
              {result.checks.map((c, i) => (
                <li key={i} className={c.ok ? 'is-ok' : ''}>
                  {c.ok ? '✔' : '·'} {c.label}
                </li>
              ))}
            </ul>
          )}

          {!succeeded && (
            <div className="con-hints">
              {mission.hints.slice(0, hintsShown).map((h, i) => (
                <p key={i} className="con-hint">
                  <strong>힌트 {i + 1}</strong> {h}
                </p>
              ))}
              {hintsShown < mission.hints.length && (
                <button type="button" className="sim-btn is-small" onClick={() => setHintsShown((n) => n + 1)}>
                  힌트 {hintsShown + 1} 보기
                </button>
              )}
            </div>
          )}

          {succeeded && (
            <div className="con-explain">
              <h4>왜 이게 답인가</h4>
              <p>{mission.explanation}</p>
              {next ? (
                <button type="button" className="sim-btn is-primary" onClick={() => onChange(next.id)}>
                  다음 미션: {next.title} ▶
                </button>
              ) : (
                <button type="button" className="sim-btn" onClick={() => onChange(null)}>
                  모든 미션 끝 · 자유 모드로
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
