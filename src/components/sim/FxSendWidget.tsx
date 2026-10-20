// 리버브·딜레이 위젯(4차 #57). 채널 하나를 FX 버스로 보내(Send) 돌아오는 소리(Return)를 섞는다.
// 처리 켜기/끄기 = 리턴 켜기/끄기. 원음은 그대로 메인으로 간다.
import { useMemo } from 'react';
import { useStore } from 'zustand';
import { beatMs } from '../../audio/dsp/reverb';
import { DEFAULT_SONG } from '../../audio/library';
import type { FxType } from '../../stores/mixer-model';
import { fmtDb } from '../ui/scale';
import { More, Slider } from '../ui/controls';
import { Meter } from '../ui/Meter';
import { WidgetShell } from './WidgetShell';
import { createWidgetStore } from './widget-store';

const COLOR = 'var(--fn-fx)';

export default function FxSendWidget({ fx = 'reverb' }: { fx?: FxType }) {
  const bpm = DEFAULT_SONG.bpm;
  const store = useMemo(
    () =>
      createWidgetStore({
        roles: fx === 'delay' ? ['lead-vocal', 'guitar', 'snare'] : ['lead-vocal', 'backing-vocal', 'snare', 'guitar'],
        buses: [{ name: fx === 'delay' ? '딜레이' : '리버브', kind: 'fx', fx }],
        initial: {
          channels: { 0: { sends: [{ levelDb: -6, tap: 'post' }] } },
          auxes: { 0: { fx: { timeMs: Math.round(beatMs(bpm, 0.75)), feedbackPct: 25, decayS: 1.8, preDelayMs: 20 } } },
        },
      }),
    [fx, bpm],
  );
  const send = useStore(store, (s) => s.channels[0].sends[0]);
  const bus = useStore(store, (s) => s.auxes[0]);
  const r = useStore(store, (s) => s.profile.ranges);
  const a = useStore(store, (s) => s.actions);
  const setFx = (p: Parameters<typeof a.setFx>[1]) => a.setFx(0, p);
  const f = bus.fx;

  return (
    <WidgetShell
      title={fx === 'delay' ? '딜레이' : '리버브'}
      accent={COLOR}
      store={store}
      bypassed={bus.returnMute}
      onBypass={() => a.setFxReturn(0, { returnMute: !bus.returnMute })}
      footer={
        fx === 'delay'
          ? '딜레이는 소리를 늦춰 메아리처럼 되풀이한다. 곡 박자에 맞추면 메아리가 박자 사이로 숨어 덜 지저분하다.'
          : '리버브는 방 울림을 더한다. 원음은 그대로 두고 돌아오는 잔향만 섞으므로, 처리를 끄면 잔향만 빠진다.'
      }
    >
      {({ engine, status }) => (
        <>
          <div className="sim-visual" style={{ justifyContent: 'center' }}>
            <div className="sim-meters">
              <Meter read={() => engine?.faderPeakDb(0) ?? -Infinity} active={status === 'playing'} height={110} label="원음" />
              <Meter read={() => engine?.fxReturnPeakDb(0) ?? -Infinity} active={status === 'playing'} height={110} label={fx === 'delay' ? '메아리' : '잔향'} />
            </div>
          </div>
          <Slider label="보내는 양" hint="이 채널을 이펙트에 얼마나 보낼지" value={send.levelDb} range={r.send} scale="fader" onChange={(v) => a.setSend(0, 0, { levelDb: v })} color={COLOR} format={fmtDb} />
          {fx === 'delay' ? (
            <>
              <Slider label="시간" hint="메아리가 돌아오는 간격" value={f.timeMs} range={r.fxTime} onChange={(v) => setFx({ timeMs: v })} color={COLOR} />
              <div className="mx-beats">
                <span className="sim-stat">{bpm} BPM에 맞추기</span>
                {[
                  { q: 1, label: '4분' },
                  { q: 0.75, label: '점8분' },
                  { q: 0.5, label: '8분' },
                ].map((b) => (
                  <button key={b.q} type="button" className="sim-btn is-small" onClick={() => setFx({ timeMs: Math.round(beatMs(bpm, b.q)) })}>
                    {b.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <Slider label="잔향 길이" hint="소리가 60 dB 작아지기까지. 길수록 넓은 공간처럼 들린다" value={f.decayS} range={r.fxDecay} onChange={(v) => setFx({ decayS: v })} color={COLOR} defaultValue={1.8} />
          )}
          <More label={fx === 'delay' ? '더 자세히: 피드백·하이컷·리턴' : '더 자세히: 프리딜레이·하이컷·로우컷·리턴'}>
            {fx === 'delay' ? (
              <Slider label="피드백" hint="메아리가 몇 번 되풀이될지" value={f.feedbackPct} range={r.fxFeedback} onChange={(v) => setFx({ feedbackPct: v })} color={COLOR} />
            ) : (
              <>
                <Slider label="프리딜레이" hint="원음과 잔향 사이 틈. 늘리면 가사가 또렷하다" value={f.preDelayMs} range={r.fxPreDelay} onChange={(v) => setFx({ preDelayMs: v })} color={COLOR} />
                <Slider label="로우컷" hint="잔향의 저음을 깎아 덜 웅웅하게" value={f.loCutHz} range={r.fxLoCut} onChange={(v) => setFx({ loCutHz: v })} color={COLOR} />
              </>
            )}
            <Slider label="하이컷" hint="이펙트 소리의 고음을 깎아 덜 쏘게" value={f.hiCutHz} range={r.fxHiCut} onChange={(v) => setFx({ hiCutHz: v })} color={COLOR} />
            <Slider label="리턴" hint="돌아오는 이펙트 소리 전체 크기" value={bus.returnDb} range={r.fader} scale="fader" onChange={(v) => a.setFxReturn(0, { returnDb: v })} color={COLOR} format={fmtDb} />
          </More>
        </>
      )}
    </WidgetShell>
  );
}
