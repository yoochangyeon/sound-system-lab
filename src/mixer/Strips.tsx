// 채널 8개. 기본 보기는 페이더·끄기·메인, 전체 보기는 솔로와 묶음 표시(DCA·뮤트 그룹·링크·세이프)를 더한다.
import { useStore } from 'zustand';
import { Fader } from '../components/ui/Fader';
import { Meter } from '../components/ui/Meter';
import type { Ctx } from './ctx';

export function Strips({ store, engine, playing, full, selected, onSelect }: Ctx & { selected: number; onSelect: (ch: number) => void }) {
  const channels = useStore(store, (s) => s.channels);
  const dca = useStore(store, (s) => s.dca);
  const muteGroups = useStore(store, (s) => s.muteGroups);
  const links = useStore(store, (s) => s.links);
  const safes = useStore(store, (s) => s.safes);
  const a = useStore(store, (s) => s.actions);
  return (
    <section className="mx-card" aria-label="채널">
      <div className="mx-card-head">
        <h2>채널</h2>
        <span className="sim-stat">이름을 누르면 아래에서 자세히 만진다</span>
      </div>
      <div className="mx-strips">
        {channels.map((c, i) => {
          const tags = full
            ? [
                ...dca.flatMap((d, k) => (d.members[i] ? [`D${k + 1}`] : [])),
                ...muteGroups.flatMap((g, k) => (g.members[i] ? [`M${k + 1}`] : [])),
                ...(links[i >> 1] ? ['링크'] : []),
                ...(safes[i] ? ['세이프'] : []),
              ]
            : [];
          return (
            <div key={i} className={`mx-strip${selected === i ? ' is-selected' : ''}`}>
              <button type="button" className="mx-name" onClick={() => onSelect(i)} aria-pressed={selected === i}>
                <small>{i + 1}</small>
                <span>{c.name}</span>
              </button>
              {full && <div className="mx-tags">{tags.length ? tags.join(' ') : ' '}</div>}
              <div className="mx-fader-row">
                <Meter read={() => engine?.faderPeakDb(i) ?? -Infinity} active={playing} height={128} width={8} />
                <Fader label={`${c.name} 페이더`} value={c.faderDb} onChange={(v) => a.setFader(i, v)} height={140} color="var(--accent)" />
              </div>
              <button type="button" className={`mx-toggle is-mute${c.mute ? ' is-on' : ''}`} aria-pressed={c.mute} onClick={() => a.setMute(i, !c.mute)}>
                {c.mute ? '꺼짐' : '끄기'}
              </button>
              <button
                type="button"
                className={`mx-toggle is-main${c.mainAssign ? ' is-on' : ''}`}
                aria-pressed={c.mainAssign}
                onClick={() => a.setMainAssign(i, !c.mainAssign)}
                title="메인 스피커로 보내기"
              >
                메인
              </button>
              {full && (
                <button
                  type="button"
                  className={`mx-toggle is-solo${c.solo ? ' is-on' : ''}`}
                  aria-pressed={c.solo}
                  onClick={() => a.setSolo(i, !c.solo)}
                  title="이 채널만 이어폰으로 듣기(메인 스피커는 그대로)"
                >
                  솔로
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="mx-legend">
        <span className="mx-dot is-mute" /> 끄기(뮤트): 채널 소리를 통째로 끈다 · <span className="mx-dot is-main" /> 메인: 메인 스피커로 보낸다
        {full && (
          <>
            {' '}
            · <span className="mx-dot is-solo" /> 솔로: 이 채널만 이어폰으로 듣는다 · D: DCA, M: 뮤트 그룹
          </>
        )}
      </p>
    </section>
  );
}
