// 처리기 위젯 공통 틀(기획서 S03): 제목, 바이패스, 음원 선택, 재생/정지, 볼륨 안내.
import type { ReactNode } from 'react';
import { useStore } from 'zustand';
import type { MixerEngine } from '../../audio/engine';
import type { MixerStoreApi } from '../../stores/mixer';
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
        {onBypass && (
          <button
            type="button"
            className={`sim-btn sim-bypass${bypassed ? ' is-on' : ''}`}
            aria-pressed={bypassed}
            onClick={onBypass}
            title="처리를 끄고 원래 소리를 듣는다"
          >
            {bypassed ? '바이패스 중 (처리 꺼짐)' : '바이패스'}
          </button>
        )}
      </header>
      <div className="sim-widget-transport">
        <button type="button" className={`sim-btn sim-play is-primary${status === 'playing' ? ' is-playing' : ''}`} onClick={toggle}>
          {status === 'playing' ? '■ 정지' : status === 'loading' ? '불러오는 중…' : '▶ 재생'}
        </button>
        <label className="sim-select">
          <span>음원</span>
          <select value={patch ?? 0} onChange={(e) => setPatch(0, Number(e.target.value))}>
            {inputs.map((input, i) => (
              <option key={input.stemId ?? i} value={i}>
                {input.label}
              </option>
            ))}
          </select>
        </label>
        {status === 'error' && <span className="sim-error">소리를 불러오지 못했습니다. 새로고침해 주세요.</span>}
      </div>
      <div className="sim-widget-body">{children({ engine, status })}</div>
      {footer && <div className="sim-widget-foot">{footer}</div>}
      {needNotice && <VolumeNotice onAccept={acceptNotice} onCancel={cancelNotice} />}
    </section>
  );
}
