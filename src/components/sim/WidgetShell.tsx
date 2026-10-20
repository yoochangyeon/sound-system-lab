// 처리기 위젯 공통 틀(기획서 S03): 제목, 처리 켜기/끄기, 재생/정지, 음원 칩, 볼륨 안내.
import type { ReactNode } from 'react';
import { useStore } from 'zustand';
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
        <div className="sim-chips" role="radiogroup" aria-label="음원">
          {inputs.map((input, i) => (
            <button
              key={input.stemId ?? i}
              type="button"
              role="radio"
              aria-checked={(patch ?? 0) === i}
              className={`sim-chip${(patch ?? 0) === i ? ' is-active' : ''}`}
              onClick={() => setPatch(0, i)}
            >
              {input.label}
            </button>
          ))}
        </div>
        {status === 'error' && <span className="sim-error">소리를 불러오지 못했습니다. 새로고침해 주세요.</span>}
      </div>
      <div className="sim-widget-body">{children({ engine, status })}</div>
      {footer && <div className="sim-widget-foot">{footer}</div>}
      {needNotice && <VolumeNotice onAccept={acceptNotice} onCancel={cancelNotice} />}
    </section>
  );
}
