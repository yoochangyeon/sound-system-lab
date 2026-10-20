// 처리기 위젯 공통 틀(기획서 S03): 제목, 처리 켜기/끄기, 재생/정지, 곡·소스 고르기, 볼륨 안내.
import type { ReactNode } from 'react';
import { useStore } from 'zustand';
import { SONGS, stemById } from '../../audio/library';
import type { MixerEngine } from '../../audio/engine';
import type { MixerStoreApi } from '../../stores/mixer';
import { Switch } from '../ui/controls';
import { usePlayback, type PlayStatus } from '../ui/usePlayback';
import { VolumeNotice } from '../ui/VolumeNotice';
import './sim.css';

export interface WidgetShellProps {
  title: string;
  accent: string;
  store: MixerStoreApi;
  bypassed?: boolean;
  onBypass?: () => void;
  children: (ctx: { engine: MixerEngine | null; status: PlayStatus }) => ReactNode;
  footer?: ReactNode;
}

export function WidgetShell({ title, accent, store, bypassed, onBypass, children, footer }: WidgetShellProps) {
  const { engine, status, toggle, needNotice, acceptNotice, cancelNotice } = usePlayback(store);
  const inputs = useStore(store, (s) => s.inputs);
  const patch = useStore(store, (s) => s.patch[0]);
  const setPatch = useStore(store, (s) => s.actions.setPatch);

  return (
    <section className="sim-panel sim-widget" style={{ ['--accent-fn' as string]: accent }}>
      <header className="sim-widget-head">
        <h3>
          <span className="sim-dot" /> {title}
        </h3>
        {onBypass && <Switch on={!bypassed} onChange={onBypass} label={bypassed ? '처리 꺼짐' : '처리 켜짐'} color={accent} />}
      </header>
      <div className="sim-widget-transport">
        <button type="button" className={`sim-btn sim-play is-primary${status === 'playing' ? ' is-playing' : ''}`} onClick={toggle}>
          {status === 'playing' ? '■ 정지' : status === 'loading' ? '불러오는 중…' : '▶ 들어 보기'}
        </button>
        <SourcePicker inputs={inputs} patch={patch ?? 0} onPick={(i) => setPatch(0, i)} />
        {status === 'error' && <span className="sim-error">소리를 불러오지 못했습니다. 새로고침해 주세요.</span>}
      </div>
      <div className="sim-widget-body">{children({ engine, status })}</div>
      {footer && <div className="sim-widget-foot">{footer}</div>}
      {needNotice && <VolumeNotice onAccept={acceptNotice} onCancel={cancelNotice} />}
    </section>
  );
}

/** 곡 → 소스 고르기. 곡이 하나면 곡 이름만 보인다. */
function SourcePicker({ inputs, patch, onPick }: { inputs: { label: string; stemId: string | null }[]; patch: number; onPick: (i: number) => void }) {
  const current = stemById(inputs[patch]?.stemId ?? '');
  const songId = current?.songId ?? SONGS[0].id;
  const song = SONGS.find((x) => x.id === songId) ?? SONGS[0];
  const options = inputs.map((inp, i) => ({ i, stem: stemById(inp.stemId ?? '') })).filter((x) => x.stem?.songId === songId);
  const songs = SONGS.filter((sg) => inputs.some((inp) => stemById(inp.stemId ?? '')?.songId === sg.id));
  return (
    <div className="sim-source">
      <div className="sim-source-song">
        <span>곡</span>
        {songs.length > 1 ? (
          <select
            value={songId}
            onChange={(e) => {
              const first = inputs.findIndex((inp) => stemById(inp.stemId ?? '')?.songId === e.target.value);
              if (first >= 0) onPick(first);
            }}
            aria-label="곡 고르기"
          >
            {songs.map((sg) => (
              <option key={sg.id} value={sg.id}>
                {sg.artist} · {sg.title}
              </option>
            ))}
          </select>
        ) : (
          <strong>
            {song.artist} · {song.title}
          </strong>
        )}
      </div>
      <div className="sim-chips" role="radiogroup" aria-label="소스">
        {options.map(({ i, stem }) => (
          <button key={i} type="button" role="radio" aria-checked={patch === i} className={`sim-chip${patch === i ? ' is-active' : ''}`} onClick={() => onPick(i)}>
            {stem?.label}
          </button>
        ))}
      </div>
    </div>
  );
}
