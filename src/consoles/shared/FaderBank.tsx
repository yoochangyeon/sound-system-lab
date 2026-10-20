// 페이더 뱅크: 채널 16개(선택·뮤트·팬·메인 할당·미터·페이더) + 메인.
// "Sends on Faders": Aux를 고르면 페이더가 그 Aux로 가는 센드 레벨이 된다(두 기종 모두 있는 기능).
import { useStore } from 'zustand';
import { Fader } from '../../components/ui/Fader';
import { Meter } from '../../components/ui/Meter';
import { MainStripPanel, type PanelProps } from './panels';

export interface FaderBankProps extends PanelProps {
  selected: number;
  onSelect: (ch: number) => void;
  /** 'main'이면 채널 페이더, 숫자면 그 Aux로 가는 센드 */
  layer: 'main' | number;
  faderHeight?: number;
}

export function FaderBank({ store, engine, playing, selected, onSelect, layer, faderHeight = 150 }: FaderBankProps) {
  const channels = useStore(store, (s) => s.channels);
  const auxes = useStore(store, (s) => s.auxes);
  const a = useStore(store, (s) => s.actions);
  const onSends = layer !== 'main';
  return (
    <div className={`con-bank${onSends ? ' is-sends' : ''}`}>
      <div className="con-bank-strips">
        {channels.map((c, i) => {
          const value = onSends ? c.sends[layer].levelDb : c.faderDb;
          return (
            <div key={i} className={`con-strip${selected === i ? ' is-selected' : ''}`}>
              <button type="button" className={`con-sel${selected === i ? ' is-active' : ''}`} onClick={() => onSelect(i)} aria-pressed={selected === i}>
                <span className="con-ch-no">{i + 1}</span>
                <span className="con-ch-name">{c.name}</span>
              </button>
              <button
                type="button"
                className={`sim-btn is-small con-assign${c.mainAssign ? ' is-active' : ''}`}
                aria-pressed={c.mainAssign}
                onClick={() => a.setMainAssign(i, !c.mainAssign)}
                title="메인 L/R 할당"
              >
                MAIN
              </button>
              <input
                className="con-pan"
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={c.pan}
                aria-label={`${c.name} 팬`}
                onChange={(e) => a.setPan(i, Number(e.target.value))}
                onDoubleClick={() => a.setPan(i, 0)}
                title={`팬 ${c.pan === 0 ? '가운데' : c.pan < 0 ? `왼쪽 ${Math.round(-c.pan * 100)}` : `오른쪽 ${Math.round(c.pan * 100)}`}`}
              />
              <div className="con-fader-row">
                <Meter read={() => engine?.faderPeakDb(i) ?? -Infinity} active={playing} height={faderHeight - 30} width={8} />
                <Fader
                  label={onSends ? `${c.name} → ${auxes[layer].name} 센드` : `${c.name} 페이더`}
                  value={value}
                  onChange={(v) => (onSends ? a.setSend(i, layer, { levelDb: v }) : a.setFader(i, v))}
                  height={faderHeight}
                  color={onSends ? 'var(--fn-bus)' : 'var(--panel-text)'}
                />
              </div>
              <button type="button" className={`sim-btn is-small is-mute${c.mute ? ' is-active' : ''}`} aria-pressed={c.mute} onClick={() => a.setMute(i, !c.mute)}>
                MUTE
              </button>
            </div>
          );
        })}
      </div>
      <MainStripPanel store={store} engine={engine} playing={playing} />
    </div>
  );
}
