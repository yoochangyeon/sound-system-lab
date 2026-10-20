// 쉬운 믹서(기획서 S05, 2차 개편 #36). 실제 기종을 본뜨지 않은 학습용 8채널 믹서.
// 소리 엔진·저장소·미션은 위젯과 같은 것을 쓴다. 휴대폰에서는 채널 줄만 가로로 스크롤한다.
// 곡을 고르면(#45) 그 곡의 채널 배치로 믹서를 새로 만든다. '정답 믹스'로 원곡 믹스와 번갈아 듣는다.
// 4차: 기본 보기(위 그대로)와 전체 보기(게이트·인서트·센드·설정 탭, 그룹·FX·매트릭스, DCA·뮤트 그룹·솔로·씬·오실레이터).
import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { DEFAULT_SONG, SONGS, songById, type Song } from '../audio/library';
import { Tabs } from '../components/ui/controls';
import { usePlayback } from '../components/ui/usePlayback';
import { VolumeNotice } from '../components/ui/VolumeNotice';
import { createMixerStore } from '../stores/mixer';
import type { ListenTarget } from '../stores/mixer-model';
import { GENERIC_PROFILE } from '../stores/profile';
import { buildMissions } from '../missions';
import { ChannelDetail } from './ChannelDetail';
import { ConsoleTools } from './ConsoleTools';
import type { Ctx, MixerView } from './ctx';
import { MissionCard } from './MissionCard';
import { mixerDefaultState } from './mixer-state';
import { Outputs } from './Outputs';
import { loadScenes, loadView, saveScenes, saveView } from './scene-storage';
import { Strips } from './Strips';
import '../components/sim/sim.css';
import './mixer.css';

/** 원곡 믹스는 마스터링되어 커서, 내 믹스(기본 믹스)와 비슷한 크기로 줄여 튼다(dB).
 *  2026-10-20 측정: 기본 믹스 메인 RMS 약 −26 dBFS, 원곡 믹스 구간 RMS −8.8 dBFS. */
const REFERENCE_TRIM_DB = -17;

export default function MixerApp() {
  const [songId, setSongId] = useState(DEFAULT_SONG.id);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('song');
    if (id && songById(id)) setSongId(id);
  }, []);
  const song = songById(songId) ?? DEFAULT_SONG;
  const pickSong = (id: string) => {
    setSongId(id);
    const url = new URL(location.href);
    url.searchParams.set('song', id);
    url.searchParams.delete('mission');
    history.replaceState(null, '', url);
  };
  // 곡이 바뀌면 저장소·엔진을 새로 만든다.
  return <MixerForSong key={song.id} song={song} onPickSong={pickSong} />;
}

function MixerForSong({ song, onPickSong }: { song: Song; onPickSong: (id: string) => void }) {
  const store = useMemo(() => createMixerStore(mixerDefaultState(song), GENERIC_PROFILE), [song]);
  const [view, setViewState] = useState<MixerView>('basic');
  const setView = (v: MixerView) => {
    setViewState(v);
    saveView(v);
  };
  useEffect(() => setViewState(loadView()), []);
  const missions = useMemo(() => buildMissions(song), [song]);
  const { engine, status, toggle, needNotice, acceptNotice, cancelNotice } = usePlayback(store);
  useEffect(() => {
    if (engine) void engine.setReference(song.reference?.file ?? null, REFERENCE_TRIM_DB);
  }, [engine, song]);
  const playing = status === 'playing';
  const [selected, setSelected] = useState(0);
  const [missionId, setMissionId] = useState<string | null>(null);
  const listen = useStore(store, (s) => s.listen);
  const auxes = useStore(store, (s) => s.auxes);
  const matrix = useStore(store, (s) => s.matrix);
  const soloed = useStore(store, (s) => s.channels.filter((c) => c.solo).length);
  const a = useStore(store, (s) => s.actions);
  const full = view === 'full';
  const ctx: Ctx = { store, engine, playing, full, bpm: song.bpm };

  // 씬은 곡마다 브라우저에 남긴다. 미션 중에는 미션이 정한 씬을 쓰고 저장하지 않는다.
  useEffect(() => {
    if (missionId) return;
    const saved = loadScenes(song.id);
    if (saved) store.getState().actions.setScenes(saved);
    return store.subscribe((next, prev) => {
      if (next.scenes !== prev.scenes) saveScenes(song.id, next.scenes);
    });
  }, [store, song.id, missionId]);

  // 레슨의 미션 링크(?mission=howl)로 바로 연다.
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('mission');
    if (id && missions.some((m) => m.id === id)) setMissionId(id);
  }, []);
  const changeMission = (id: string | null) => {
    setMissionId(id);
    const url = new URL(location.href);
    if (id) url.searchParams.set('mission', id);
    else url.searchParams.delete('mission');
    history.replaceState(null, '', url);
  };

  return (
    <div className="sim-panel mx">
      <div className="mx-bar">
        <button type="button" className={`sim-btn sim-play is-primary${playing ? ' is-playing' : ''}`} onClick={toggle}>
          {playing ? '■ 정지' : status === 'loading' ? '불러오는 중…' : '▶ 소리 켜기'}
        </button>
        <div className="mx-listen">
          <span className="sim-stat">이어폰으로 듣기</span>
          <Tabs<ListenTarget>
            label="듣기"
            items={[
              { id: 'main', label: '메인' },
              ...auxes.flatMap((b, i) => (b.kind === 'monitor' ? [{ id: i, label: b.name.replace(/ (보컬|밴드)$/, '') }] : [])),
              ...(full ? matrix.map((m, i) => ({ id: `matrix-${i}` as const, label: m.name })) : []),
              ...(song.reference ? [{ id: 'reference' as const, label: '정답 믹스' }] : []),
            ]}
            value={listen}
            onChange={(v) => a.setListen(v)}
          />
          {soloed > 0 && (
            <span className="mx-solo-note">
              솔로 {soloed}개를 듣는 중{' '}
              <button type="button" className="sim-btn is-small" onClick={() => a.clearSolo()}>
                모두 해제
              </button>
            </span>
          )}
        </div>
        <div className="mx-view">
          <span className="sim-stat">보기</span>
          <Tabs<MixerView>
            label="믹서 보기"
            items={[
              { id: 'basic', label: '기본' },
              { id: 'full', label: '전체' },
            ]}
            value={view}
            onChange={setView}
          />
        </div>
        {status === 'error' && <span className="sim-error">소리를 불러오지 못했습니다. 새로고침해 주세요.</span>}
        <div className="mx-song">
          <span className="sim-stat">곡</span>
          {SONGS.length > 1 ? (
            <select value={song.id} onChange={(e) => onPickSong(e.target.value)} aria-label="곡 고르기">
              {SONGS.map((sg) => (
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
          <span className="sim-stat">
            {song.genre} · {song.bpm} BPM · {song.excerpt.bars}마디 반복
          </span>
          {listen === 'reference' && <span className="mx-ref-note">지금 원곡 믹스를 듣는 중. 내 믹스 조작은 들리지 않는다</span>}
        </div>
      </div>

      <div className="mx-grid">
        <div className="mx-col is-left">
          <div className="mx-area-strips">
            <Strips {...ctx} selected={selected} onSelect={setSelected} />
          </div>
          <div className="mx-area-detail">
            <ChannelDetail {...ctx} ch={selected} />
          </div>
        </div>
        <div className="mx-col is-right">
          <div className="mx-area-mission">
            <MissionCard store={store} missions={missions} missionId={missionId} onChange={changeMission} onFocusChannel={setSelected} onNeedFull={() => setView('full')} />
          </div>
          {full && (
            <div className="mx-area-tools">
              <ConsoleTools {...ctx} />
            </div>
          )}
          <div className="mx-area-out">
            <Outputs {...ctx} />
          </div>
        </div>
      </div>

      {needNotice && <VolumeNotice onAccept={acceptNotice} onCancel={cancelNotice} />}
    </div>
  );
}
