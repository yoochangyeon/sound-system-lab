// 전체 보기의 콘솔 기능: DCA, 뮤트 그룹, 솔로, 씬, 오실레이터.
import { useState } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { Slider, Switch, Tabs } from '../components/ui/controls';
import { fmtDb } from '../components/ui/scale';
import type { OscType, SoloMode } from '../stores/mixer-model';
import type { Ctx } from './ctx';

type ToolTab = 'dca' | 'mute' | 'solo' | 'scene' | 'osc';

export function ConsoleTools(ctx: Ctx) {
  const [tab, setTab] = useState<ToolTab>('dca');
  return (
    <section className="mx-card" aria-label="콘솔 기능">
      <div className="mx-card-head">
        <h2>콘솔 기능</h2>
      </div>
      <Tabs
        label="콘솔 기능"
        items={[
          { id: 'dca' as const, label: 'DCA' },
          { id: 'mute' as const, label: '뮤트 그룹' },
          { id: 'solo' as const, label: '솔로' },
          { id: 'scene' as const, label: '씬' },
          { id: 'osc' as const, label: '오실레이터' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="mx-detail-body">
        {tab === 'dca' && <DcaTab {...ctx} />}
        {tab === 'mute' && <MuteTab {...ctx} />}
        {tab === 'solo' && <SoloTab {...ctx} />}
        {tab === 'scene' && <SceneTab {...ctx} />}
        {tab === 'osc' && <OscTab {...ctx} />}
      </div>
    </section>
  );
}

const memberNames = (members: boolean[], names: string[]) => names.filter((_, i) => members[i]).join(', ') || '묶인 채널 없음(채널 상세의 설정 탭에서 묶는다)';

function DcaTab({ store }: Ctx) {
  const dca = useStore(store, (s) => s.dca);
  const names = useStore(store, useShallow((s) => s.channels.map((c) => c.name)));
  const r = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  return (
    <>
      <p className="mx-note">DCA는 소리가 지나가지 않는 원격 페이더다. 묶인 채널의 페이더에 이 값을 더한다. 채널끼리의 균형은 그대로 두고 한꺼번에 올리고 내린다.</p>
      {dca.map((d, i) => (
        <div key={i} className="mx-out">
          <Slider label={d.name} hint={memberNames(d.members, names)} value={d.faderDb} range={r.fader} scale="fader" onChange={(v) => a.setDca(i, { faderDb: v })} format={fmtDb} />
          <div className="mx-out-actions">
            <button type="button" className={`mx-toggle is-mute${d.mute ? ' is-on' : ''}`} aria-pressed={d.mute} onClick={() => a.setDca(i, { mute: !d.mute })}>
              {d.mute ? '꺼짐' : '끄기'}
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

function MuteTab({ store }: Ctx) {
  const groups = useStore(store, (s) => s.muteGroups);
  const names = useStore(store, useShallow((s) => s.channels.map((c) => c.name)));
  const a = useStore(store, (s) => s.actions);
  return (
    <>
      <p className="mx-note">켜면 묶인 채널을 한꺼번에 끈다. 설교 시작할 때 밴드를 모두 끄는 식으로 쓴다.</p>
      {groups.map((g, i) => (
        <div key={i} className="sim-group-title">
          <span>
            {g.name} · <small>{memberNames(g.members, names)}</small>
          </span>
          <Switch on={g.on} onChange={(on) => a.setMuteGroup(i, on)} label={g.on ? '끄는 중' : '켜기'} color="var(--red)" />
        </div>
      ))}
    </>
  );
}

function SoloTab({ store }: Ctx) {
  const mode = useStore(store, (s) => s.soloMode);
  const soloed = useStore(store, useShallow((s) => s.channels.filter((c) => c.solo).map((c) => c.name)));
  const a = useStore(store, (s) => s.actions);
  return (
    <>
      <p className="mx-note">솔로는 고른 채널만 이어폰(방송실 모니터)으로 듣는 기능이다. 메인 스피커 소리는 바뀌지 않는다.</p>
      <Tabs<SoloMode>
        label="솔로 방식"
        items={[
          { id: 'pfl', label: 'PFL · 페이더 앞' },
          { id: 'afl', label: 'AFL · 페이더 뒤' },
        ]}
        value={mode}
        onChange={(m) => a.setSoloMode(m)}
      />
      <p className="mx-note">{mode === 'pfl' ? 'PFL은 페이더·뮤트와 상관없이 들린다. 꺼 둔 채널에서 무엇이 들어오는지 확인할 때 쓴다.' : 'AFL은 페이더와 팬을 지난 소리다. 메인에 나가는 모양 그대로 듣는다.'}</p>
      <p className="sim-stat">지금 솔로: {soloed.length ? soloed.join(', ') : '없음'}</p>
      <button type="button" className="sim-btn is-small" disabled={!soloed.length} onClick={() => a.clearSolo()}>
        솔로 모두 해제
      </button>
    </>
  );
}

function SceneTab({ store }: Ctx) {
  const scenes = useStore(store, (s) => s.scenes);
  const safes = useStore(store, (s) => s.safes);
  const names = useStore(store, useShallow((s) => s.channels.map((c) => c.name)));
  const a = useStore(store, (s) => s.actions);
  const safeNames = names.filter((_, i) => safes[i]);
  return (
    <>
      <p className="mx-note">씬은 믹서 상태 전체를 저장했다가 한 번에 불러오는 기능이다. 찬양·설교·광고처럼 예배 순서마다 하나씩 둔다. 이 브라우저에 남는다.</p>
      <p className="sim-stat">리콜 세이프(불러와도 그대로): {safeNames.length ? safeNames.join(', ') : '없음'}</p>
      {scenes.map((sc, i) => (
        <div key={i} className="mx-scene">
          <strong>{sc.name}</strong>
          <span className="sim-stat">{sc.snapshot ? '저장됨' : '비어 있음'}</span>
          <button type="button" className="sim-btn is-small" onClick={() => a.saveScene(i)}>
            지금 상태 저장
          </button>
          <button type="button" className="sim-btn is-small is-primary" disabled={!sc.snapshot} onClick={() => a.recallScene(i)}>
            불러오기
          </button>
        </div>
      ))}
    </>
  );
}

function OscTab({ store }: Ctx) {
  const o = useStore(store, (s) => s.osc);
  const auxes = useStore(store, (s) => s.auxes);
  const r = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  return (
    <>
      <p className="mx-note">오실레이터는 시험 신호다. 예배 전에 스피커가 다 나오는지, 버스 레벨이 맞는지 볼 때 쓴다. 처음엔 작게 켠다.</p>
      <div className="sim-group-title">
        <span>오실레이터</span>
        <Switch on={o.on} onChange={(on) => a.setOsc({ on })} label={o.on ? '켜짐' : '꺼짐'} />
      </div>
      <Tabs<OscType>
        label="신호 종류"
        items={[
          { id: 'pink', label: '핑크 노이즈' },
          { id: 'sine', label: '사인파' },
        ]}
        value={o.type}
        onChange={(type) => a.setOsc({ type })}
      />
      {o.type === 'sine' && <Slider label="주파수" value={o.freq} range={r.eqFreq} onChange={(freq) => a.setOsc({ freq })} />}
      <Slider label="크기" value={o.levelDb} range={r.fader} scale="fader" onChange={(levelDb) => a.setOsc({ levelDb })} format={fmtDb} />
      <label className="mx-field">
        <span>보낼 곳</span>
        <select value={String(o.target)} onChange={(e) => a.setOsc({ target: e.target.value === 'main' ? 'main' : Number(e.target.value) })}>
          <option value="main">메인</option>
          {auxes.map((b, i) => (
            <option key={i} value={i}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
