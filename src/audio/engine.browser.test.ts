// 경계 ③: 실제 Web Audio 그래프와 워클릿을 OfflineAudioContext로 렌더링해 출력 레벨을 잰다.
import { describe, expect, it } from 'vitest';
import { BUTTERWORTH_Q_DB, biquadResponseDb, type BiquadParams } from './dsp/biquad';
import { Compressor } from './dsp/dynamics';
import { ensureWorklets } from './worklets';
import { burstBuffer, maxAbs, renderMixer, SR, sineBuffer, tailRmsDb, windowRmsDb } from './test-helpers';
import type { MixerActions } from '../stores/mixer';

describe('엔진: 채널 스트립', () => {
  it('PEQ로 1 kHz를 6 dB 깎으면 1 kHz 사인 출력이 약 6 dB 내려간다', async () => {
    const ref = await renderMixer({ freq: 1000, db: -20 });
    const cut = await renderMixer({
      freq: 1000,
      db: -20,
      prepare: ({ store }) => store.getState().actions.setPeqBand(0, 1, { freq: 1000, gainDb: -6, q: 1 }),
    });
    expect(tailRmsDb(ref) - tailRmsDb(cut)).toBeCloseTo(6, 0);
  });

  it('HPF를 켜면 차단 주파수 아래 사인이 크게 줄고, 끄면 그대로다', async () => {
    const off = await renderMixer({ freq: 50, db: -20 });
    const on = await renderMixer({
      freq: 50,
      db: -20,
      prepare: ({ store }) => store.getState().actions.setPreamp(0, { hpfOn: true, hpfFreq: 200 }),
    });
    expect(tailRmsDb(off) - tailRmsDb(on)).toBeGreaterThan(20);
    // 가운데 팬의 등전력 법칙(−3 dB) 말고는 바뀌지 않는다
    expect(tailRmsDb(off)).toBeCloseTo(-20 - 3 - 3.01, 0);
  });

  it('LPF를 켜면 차단 주파수 위 사인이 크게 줄고, 아래 사인은 그대로다', async () => {
    const off = await renderMixer({ freq: 8000, db: -20 });
    const on = await renderMixer({
      freq: 8000,
      db: -20,
      prepare: ({ store }) => store.getState().actions.setPreamp(0, { lpfOn: true, lpfFreq: 2000 }),
    });
    expect(tailRmsDb(off) - tailRmsDb(on)).toBeGreaterThan(20);
    const low = await renderMixer({
      freq: 200,
      db: -20,
      prepare: ({ store }) => store.getState().actions.setPreamp(0, { lpfOn: true, lpfFreq: 2000 }),
    });
    expect(tailRmsDb(low)).toBeCloseTo(-20 - 3 - 3.01, 0);
  });

  it('PEQ를 끄면(바이패스) 깎은 설정이 있어도 원래 레벨이다', async () => {
    const ref = await renderMixer({ freq: 1000, db: -20 });
    const bypassed = await renderMixer({
      freq: 1000,
      db: -20,
      prepare: ({ store }) => {
        store.getState().actions.setPeqBand(0, 1, { freq: 1000, gainDb: -12 });
        store.getState().actions.setPeqOn(0, false);
      },
    });
    expect(tailRmsDb(bypassed)).toBeCloseTo(tailRmsDb(ref), 1);
  });

  it('뮤트·메인 할당 끔·패치 없음이면 메인이 무음이다', async () => {
    for (const prepare of [
      (a: MixerActions) => a.setMute(0, true),
      (a: MixerActions) => a.setMainAssign(0, false),
      (a: MixerActions) => a.setPatch(0, null),
    ]) {
      const out = await renderMixer({ freq: 1000, db: -10, prepare: ({ store }) => prepare(store.getState().actions) });
      expect(tailRmsDb(out)).toBeLessThan(-90);
    }
  });

  it('프리엠프 게인을 과하게 올려도 클리핑 지점 출력은 ±1을 넘지 않는다', async () => {
    const ctx = new OfflineAudioContext({ numberOfChannels: 1, length: SR / 4, sampleRate: SR });
    await ensureWorklets(ctx);
    const { ChannelStrip } = await import('./channel-strip');
    const strip = new ChannelStrip(ctx, []);
    strip.preamp.gain.value = 10; // +20 dB
    const src = new AudioBufferSourceNode(ctx, { buffer: sineBuffer(ctx, 440, -3, 0.25) });
    src.connect(strip.input);
    strip.clipper.connect(ctx.destination);
    src.start(0);
    const out = await ctx.startRendering();
    expect(maxAbs(out)).toBeLessThanOrEqual(1);
    expect(maxAbs(out)).toBeGreaterThan(0.99);
  });
});

describe('엔진: 순수 응답과 노드 응답', () => {
  it('같은 설정에서 순수 Biquad 응답과 BiquadFilterNode 응답이 일치한다', () => {
    const ctx = new OfflineAudioContext({ numberOfChannels: 1, length: 128, sampleRate: SR });
    const cases: BiquadParams[] = [
      { type: 'peaking', freq: 1000, gainDb: -6, q: 1.4 },
      { type: 'lowshelf', freq: 150, gainDb: 5, q: 1 },
      { type: 'highshelf', freq: 6000, gainDb: -4, q: 1 },
      { type: 'highpass', freq: 120, gainDb: 0, q: BUTTERWORTH_Q_DB },
    ];
    const freqs = new Float32Array([40, 100, 300, 1000, 3000, 8000, 15000]);
    const mag = new Float32Array(freqs.length);
    const phase = new Float32Array(freqs.length);
    for (const p of cases) {
      const node = new BiquadFilterNode(ctx, { type: p.type, frequency: p.freq, gain: p.gainDb, Q: p.q });
      node.getFrequencyResponse(freqs, mag, phase);
      freqs.forEach((f, i) => expect(biquadResponseDb(p, f, SR)).toBeCloseTo(20 * Math.log10(mag[i]), 1));
    }
  });
});

describe('엔진: 다이내믹스 워클릿', () => {
  it('컴프 워클릿 출력이 순수 컴프 계산과 맞는다', async () => {
    const comp = { thresholdDb: -24, ratio: 4, kneeDb: 0, attackMs: 5, releaseMs: 80, makeupDb: 0, detector: 'peak' as const };
    const out = await renderMixer({
      freq: 1000,
      db: -6,
      prepare: ({ store }) => store.getState().actions.setComp(0, { on: true, ...comp }),
    });
    // 같은 입력을 순수 코드로 처리한다(가운데 팬 −3 dB는 출력 쪽에서 뺀다).
    const x = new Float32Array(out.length);
    for (let i = 0; i < x.length; i++) x[i] = Math.pow(10, -6 / 20) * Math.sin((2 * Math.PI * 1000 * i) / SR);
    new Compressor(SR).process([x], comp);
    let s = 0;
    for (let i = x.length / 2; i < x.length; i++) s += x[i] * x[i];
    const expected = 10 * Math.log10(s / (x.length / 2)) - 3.01;
    expect(tailRmsDb(out)).toBeCloseTo(expected, 0);
    // 실제로 눌렀다(입력 −6 dBFS 사인의 RMS는 약 −9 dBFS)
    expect(tailRmsDb(out)).toBeLessThan(-9 - 3 - 5);
  });

  it('안전 리미터: 0 dBFS를 넘는 신호도 출력이 상한(−1 dBFS)을 넘지 않는다', async () => {
    const out = await renderMixer({
      freq: 440,
      db: 0,
      prepare: ({ store }) => store.getState().actions.setFader(0, 10),
    });
    expect(20 * Math.log10(maxAbs(out))).toBeLessThanOrEqual(-1 + 1e-3);
  });

  it('게이트: 스레숄드 아래 신호는 레인지만큼 줄어든다', async () => {
    const ref = await renderMixer({ freq: 1000, db: -50 });
    const gated = await renderMixer({
      freq: 1000,
      db: -50,
      prepare: ({ store }) =>
        store.getState().actions.setGate(0, { on: true, thresholdDb: -30, rangeDb: 30, attackMs: 1, holdMs: 10, releaseMs: 20 }),
    });
    expect(tailRmsDb(ref) - tailRmsDb(gated)).toBeCloseTo(30, 0);
  });
});

describe('엔진: 사이드체인·모드·Mix', () => {
  // 채널 0과 1이 같은 사인 입력을 받는다. 채널 1은 뮤트해 키로만 쓴다(키는 페이더 앞에서 뽑는다).
  const twoCh = {
    shape: { channels: 2 },
    initial: (s: Parameters<NonNullable<Parameters<typeof renderMixer>[0]['initial']>>[0]) => ({ ...s, patch: [0, 0] }),
  };
  const muteKeyChannel = (a: MixerActions) => a.setMute(1, true);

  it('덕킹: 다른 채널을 키로 들으면 그 채널이 클 때 레인지만큼 줄인다(자기 소리는 스레숄드 아래)', async () => {
    const run = (key: 'self' | number) =>
      renderMixer({
        freq: 1000,
        db: -50,
        ...twoCh,
        prepare: ({ store }) => {
          const a = store.getState().actions;
          muteKeyChannel(a);
          a.setPreamp(1, { gainDb: 30 }); // 키 채널은 −20 dBFS
          a.setGate(0, { on: true, mode: 'duck', thresholdDb: -40, rangeDb: 12, attackMs: 1, holdMs: 10, releaseMs: 50, key: { source: key } });
        },
      });
    const self = await run('self');
    const ducked = await run(1);
    expect(tailRmsDb(self) - tailRmsDb(ducked)).toBeCloseTo(12, 0);
  });

  it('컴프 키를 다른 채널로 두면 자기 소리가 작아도 키가 크면 누른다', async () => {
    const run = (key: 'self' | number) =>
      renderMixer({
        freq: 1000,
        db: -40,
        ...twoCh,
        prepare: ({ store }) => {
          const a = store.getState().actions;
          muteKeyChannel(a);
          a.setPreamp(1, { gainDb: 28 }); // 키 채널은 −12 dBFS
          a.setComp(0, { on: true, thresholdDb: -20, ratio: 4, kneeDb: 0, attackMs: 1, releaseMs: 50, key: { source: key } });
        },
      });
    const self = await run('self');
    const keyed = await run(1);
    expect(tailRmsDb(self) - tailRmsDb(keyed)).toBeCloseTo(6, 0);
  });

  it('Mix 0%면 컴프를 세게 걸어도 원음 그대로다', async () => {
    const ref = await renderMixer({ freq: 1000, db: -20 });
    const dry = await renderMixer({
      freq: 1000,
      db: -20,
      prepare: ({ store }) => store.getState().actions.setComp(0, { on: true, thresholdDb: -40, ratio: 10, mixPct: 0 }),
    });
    expect(tailRmsDb(dry)).toBeCloseTo(tailRmsDb(ref), 1);
  });

  it('키 듣기: 키 필터를 지난 소리가 나온다(1 kHz 사인에 하이컷 100 Hz면 크게 준다)', async () => {
    const ref = await renderMixer({ freq: 1000, db: -20 });
    const listen = (filter: 'band' | 'highcut', freq: number) =>
      renderMixer({
        freq: 1000,
        db: -20,
        prepare: ({ store }) => store.getState().actions.setComp(0, { on: true, key: { filter, freq, listen: true } }),
      });
    expect(tailRmsDb(await listen('band', 1000))).toBeCloseTo(tailRmsDb(ref), 0);
    expect(tailRmsDb(ref) - tailRmsDb(await listen('highcut', 100))).toBeGreaterThan(20);
  });
});

describe('엔진: 채널 설정', () => {
  const twoCh = {
    shape: { channels: 2 },
    initial: (s: Parameters<NonNullable<Parameters<typeof renderMixer>[0]['initial']>>[0]) => ({ ...s, patch: [0, 0] }),
  };

  it('같은 소리 두 채널 중 하나의 극성을 뒤집으면 거의 사라진다', async () => {
    const same = await renderMixer({ freq: 500, db: -20, ...twoCh });
    const inverted = await renderMixer({ freq: 500, db: -20, ...twoCh, prepare: ({ store }) => store.getState().actions.setPreamp(1, { invert: true }) });
    expect(tailRmsDb(same) - tailRmsDb(inverted)).toBeGreaterThan(40);
  });

  it('500 Hz 사인을 한 채널만 1 ms 늦추면(반 주기) 상쇄되고, 2 ms면 다시 더해진다', async () => {
    const delayed = (ms: number) =>
      renderMixer({ freq: 500, db: -20, ...twoCh, prepare: ({ store }) => store.getState().actions.setPreamp(1, { delayOn: true, delayMs: ms }) });
    const same = await renderMixer({ freq: 500, db: -20, ...twoCh });
    expect(tailRmsDb(same) - tailRmsDb(await delayed(1))).toBeGreaterThan(30);
    expect(tailRmsDb(await delayed(2))).toBeCloseTo(tailRmsDb(same), 0);
  });
});

describe('엔진: Aux 센드', () => {
  const shape = { channels: 1, auxes: 1 };
  const listenAux = (pre: boolean, faderDb: number) =>
    renderMixer({
      freq: 1000,
      db: -20,
      shape,
      prepare: ({ store }) => {
        const a = store.getState().actions;
        a.setSend(0, 0, { levelDb: 0, tap: pre ? 'pre' : 'post' });
        a.setFader(0, faderDb);
        a.setListen(0);
      },
    });

  it('post 센드는 채널 페이더를 따르고, pre 센드는 따르지 않는다', async () => {
    const post0 = await listenAux(false, 0);
    const postDown = await listenAux(false, -10);
    const pre0 = await listenAux(true, 0);
    const preDown = await listenAux(true, -10);
    expect(tailRmsDb(post0) - tailRmsDb(postDown)).toBeCloseTo(10, 0);
    expect(tailRmsDb(pre0) - tailRmsDb(preDown)).toBeCloseTo(0, 1);
  });

  it('EQ 앞(pre-eq) 센드는 채널 PEQ를 따르지 않는다', async () => {
    const run = (tap: 'pre-eq' | 'pre') =>
      renderMixer({
        freq: 1000,
        db: -20,
        shape,
        prepare: ({ store }) => {
          const a = store.getState().actions;
          a.setSend(0, 0, { levelDb: 0, tap });
          a.setPeqBand(0, 1, { freq: 1000, gainDb: -12, q: 1 });
          a.setListen(0);
        },
      });
    expect(tailRmsDb(await run('pre-eq')) - tailRmsDb(await run('pre'))).toBeCloseTo(12, 0);
  });

  it('듣기를 Aux로 바꾸면 센드가 없는 채널은 들리지 않는다', async () => {
    const out = await renderMixer({ freq: 1000, db: -20, shape, prepare: ({ store }) => store.getState().actions.setListen(0) });
    expect(tailRmsDb(out)).toBeLessThan(-90);
  });
});

describe('엔진: 그룹·매트릭스·버스 처리', () => {
  const grp = {
    shape: { channels: 1, auxes: 2, auxKinds: ['monitor', 'group'] as ('monitor' | 'group')[], matrixNames: ['로비'] },
  };

  it('메인 할당을 끄고 그룹으로 보내면 그룹을 거쳐 같은 크기로 메인에 나온다', async () => {
    const direct = await renderMixer({ freq: 1000, db: -20, ...grp });
    const viaGroup = await renderMixer({
      freq: 1000,
      db: -20,
      ...grp,
      prepare: ({ store }) => {
        const a = store.getState().actions;
        a.setMainAssign(0, false);
        a.setSend(0, 1, { levelDb: 0 });
      },
    });
    expect(tailRmsDb(viaGroup)).toBeCloseTo(tailRmsDb(direct), 1);
  });

  it('그룹은 채널 팬을 따른다(왼쪽 끝이면 오른쪽 출력이 없다)', async () => {
    const out = await renderMixer({
      freq: 1000,
      db: -20,
      ...grp,
      prepare: ({ store }) => {
        const a = store.getState().actions;
        a.setMainAssign(0, false);
        a.setSend(0, 1, { levelDb: 0 });
        a.setPan(0, -1);
      },
    });
    expect(tailRmsDb(out, 0)).toBeGreaterThan(-30);
    expect(tailRmsDb(out, 1)).toBeLessThan(-90);
  });

  it('매트릭스는 메인을 받아 따로 들을 수 있고, 모니터 버스는 받지 않는다', async () => {
    const main = await renderMixer({ freq: 1000, db: -20, ...grp });
    const mtx = await renderMixer({
      freq: 1000,
      db: -20,
      ...grp,
      prepare: ({ store }) => {
        const a = store.getState().actions;
        a.setMatrix(0, { fromMainDb: -6 });
        a.setListen('matrix-0');
      },
    });
    expect(tailRmsDb(main) - tailRmsDb(mtx)).toBeCloseTo(6, 0);
    const monitorOnly = await renderMixer({
      freq: 1000,
      db: -20,
      ...grp,
      prepare: ({ store }) => {
        const a = store.getState().actions;
        a.setSend(0, 0, { levelDb: 0 });
        a.setMatrix(0, { fromMainDb: -Infinity, fromBus: { bus: 0, db: 0 } });
        a.setListen('matrix-0');
      },
    });
    expect(tailRmsDb(monitorOnly)).toBeLessThan(-90);
  });

  it('메인 컴프가 메인 출력을 누른다', async () => {
    const ref = await renderMixer({ freq: 1000, db: -6 });
    const comp = await renderMixer({
      freq: 1000,
      db: -6,
      prepare: ({ store }) => store.getState().actions.setBusComp('main', { on: true, thresholdDb: -30, ratio: 4, kneeDb: 0, attackMs: 1 }),
    });
    expect(tailRmsDb(ref) - tailRmsDb(comp)).toBeGreaterThan(5);
  });

  it('버스 GEQ를 올렸다가 다시 평평하게 하면 원래 크기로 돌아온다(GEQ 건너뛰기)', async () => {
    const ref = await renderMixer({ freq: 1000, db: -20 });
    const boosted = await renderMixer({ freq: 1000, db: -20, prepare: ({ store }) => store.getState().actions.setGeqBand('main', 17, 6) });
    const back = await renderMixer({
      freq: 1000,
      db: -20,
      prepare: ({ store }) => {
        const a = store.getState().actions;
        a.setGeqBand('main', 17, 6);
        a.resetGeq('main');
      },
    });
    expect(tailRmsDb(boosted) - tailRmsDb(ref)).toBeGreaterThan(4);
    expect(tailRmsDb(back)).toBeCloseTo(tailRmsDb(ref), 1);
  });
});

describe('엔진: 이펙트(Insert와 Send/Return)', () => {
  const fxShape = { channels: 1, auxes: 2, auxKinds: ['fx', 'fx'] as ('fx')[], auxFx: ['reverb', 'delay'] as ('reverb' | 'delay')[] };
  /** 채널 원음은 메인에 보내지 않고(리턴만 듣는다) FX 버스로 보낸다 */
  const sendOnly = (bus: number) => (a: MixerActions) => {
    a.setMainAssign(0, false);
    a.setSend(0, bus, { levelDb: 0, tap: 'post' });
  };

  it('리버브 센드: 짧은 소리가 끝난 뒤에도 잔향이 남고, 길게 하면 더 오래 남는다', async () => {
    const run = (decayS: number) =>
      renderMixer({
        freq: 1000,
        db: -6,
        seconds: 1.2,
        shape: fxShape,
        source: (ctx, s) => burstBuffer(ctx, s),
        prepare: ({ store }) => {
          const a = store.getState().actions;
          sendOnly(0)(a);
          a.setFx(0, { decayS, preDelayMs: 0 });
        },
      });
    const short = await run(0.4);
    const long = await run(2);
    expect(windowRmsDb(long, 0.2, 0.3)).toBeGreaterThan(-60);
    expect(windowRmsDb(long, 0.6, 0.8) - windowRmsDb(short, 0.6, 0.8)).toBeGreaterThan(20);
  });

  it('리턴을 끄거나 센드가 없으면 이펙트 소리가 없다', async () => {
    const muted = await renderMixer({
      freq: 1000,
      db: -6,
      shape: fxShape,
      prepare: ({ store }) => {
        const a = store.getState().actions;
        sendOnly(0)(a);
        a.setFxReturn(0, { returnMute: true });
      },
    });
    const noSend = await renderMixer({ freq: 1000, db: -6, shape: fxShape, prepare: ({ store }) => store.getState().actions.setMainAssign(0, false) });
    expect(tailRmsDb(muted)).toBeLessThan(-90);
    expect(tailRmsDb(noSend)).toBeLessThan(-90);
  });

  it('딜레이: 메아리가 딜레이 시간 뒤에 오고, 피드백이 있으면 한 번 더 온다', async () => {
    const run = (feedbackPct: number) =>
      renderMixer({
        freq: 1000,
        db: -6,
        seconds: 0.5,
        shape: fxShape,
        source: (ctx, s) => burstBuffer(ctx, s, 0.01),
        // 시간은 처음 상태로 둔다(재생 중에 바꾸면 램프 동안 읽는 자리가 미끄러진다).
        initial: (st) => {
          const auxes = st.auxes.slice();
          auxes[1] = { ...auxes[1], fx: { ...auxes[1].fx, timeMs: 100, feedbackPct, hiCutHz: 20000, loCutHz: 20 } };
          // 메인 할당도 처음부터 끈다(재생 중에 끄면 램프 동안 원음이 조금 샌다).
          const ch = { ...st.channels[0], mainAssign: false, sends: st.channels[0].sends.map((x, i) => (i === 1 ? { levelDb: 0, tap: 'post' as const } : x)) };
          return { ...st, auxes, channels: [ch] };
        },
      });
    const once = await run(0);
    const twice = await run(50);
    // 처음 30 ms는 메인 할당이 기본값에서 꺼지는 램프라 원음이 조금 샌다.
    expect(windowRmsDb(once, 0.03, 0.09)).toBeLessThan(-90);
    expect(windowRmsDb(once, 0.1, 0.11)).toBeGreaterThan(-30);
    expect(windowRmsDb(once, 0.2, 0.21)).toBeLessThan(-80);
    expect(windowRmsDb(twice, 0.2, 0.21)).toBeGreaterThan(-40);
  });

  it('인서트 리버브: 채널에 직접 끼우면 메인에 원음과 잔향이 함께 나오고, 끄면 잔향이 없다', async () => {
    const run = (on: boolean) =>
      renderMixer({
        freq: 1000,
        db: -6,
        seconds: 0.8,
        source: (ctx, s) => burstBuffer(ctx, s),
        prepare: ({ store }) => store.getState().actions.setInsert(0, { on, mixPct: 50, fx: { decayS: 1.5, preDelayMs: 0 } }),
      });
    expect(windowRmsDb(await run(true), 0.3, 0.4)).toBeGreaterThan(-70);
    expect(windowRmsDb(await run(false), 0.3, 0.4)).toBeLessThan(-100);
  });

  it('코러스는 왼쪽과 오른쪽이 다르게 흔들린다', async () => {
    const out = await renderMixer({
      freq: 1000,
      db: -6,
      shape: { ...fxShape, auxFx: ['chorus', 'delay'] as ('chorus' | 'delay')[] },
      prepare: ({ store }) => {
        const a = store.getState().actions;
        sendOnly(0)(a);
        a.setFx(0, { type: 'chorus', rateHz: 3, depthPct: 100, hiCutHz: 20000, loCutHz: 20 });
      },
    });
    const l = out.getChannelData(0);
    const r = out.getChannelData(1);
    let diff = 0;
    for (let i = l.length / 2; i < l.length; i++) diff = Math.max(diff, Math.abs(l[i] - r[i]));
    expect(diff).toBeGreaterThan(0.05);
  });
});

describe('엔진: DCA·뮤트 그룹·솔로·오실레이터', () => {
  const ops = { shape: { channels: 2, dcaCount: 1, muteGroupCount: 1 }, initial: (s: Parameters<NonNullable<Parameters<typeof renderMixer>[0]['initial']>>[0]) => ({ ...s, patch: [0, 0] }) };

  it('DCA를 6 dB 내리면 묶인 채널만 6 dB 내려간다', async () => {
    const run = (dcaDb: number) =>
      renderMixer({
        freq: 1000,
        db: -20,
        ...ops,
        prepare: ({ store }) => {
          const a = store.getState().actions;
          a.setMute(1, true);
          a.setDcaMember(0, 0, true);
          a.setDca(0, { faderDb: dcaDb });
        },
      });
    expect(tailRmsDb(await run(0)) - tailRmsDb(await run(-6))).toBeCloseTo(6, 0);
  });

  it('뮤트 그룹을 켜면 묶인 채널이 모두 꺼진다', async () => {
    const out = await renderMixer({
      freq: 1000,
      db: -20,
      ...ops,
      prepare: ({ store }) => {
        const a = store.getState().actions;
        a.setMuteGroupMember(0, 0, true);
        a.setMuteGroupMember(0, 1, true);
        a.setMuteGroup(0, true);
      },
    });
    expect(tailRmsDb(out)).toBeLessThan(-90);
  });

  it('PFL 솔로는 뮤트된 채널도 페이더와 상관없이 들려주고, 메인은 듣지 않는다', async () => {
    const out = await renderMixer({
      freq: 1000,
      db: -20,
      shape: { channels: 2 },
      prepare: ({ store }) => {
        const a = store.getState().actions;
        a.setPatch(1, null);
        a.setMute(0, true);
        a.setFader(0, -20);
        a.setSolo(0, true);
      },
    });
    // PFL은 모노 그대로 양쪽에 −20 dBFS 사인(RMS −23)
    expect(tailRmsDb(out)).toBeCloseTo(-23, 0);
  });

  it('AFL 솔로는 페이더를 따른다', async () => {
    const run = (faderDb: number) =>
      renderMixer({
        freq: 1000,
        db: -20,
        prepare: ({ store }) => {
          const a = store.getState().actions;
          a.setSoloMode('afl');
          a.setFader(0, faderDb);
          a.setSolo(0, true);
        },
      });
    expect(tailRmsDb(await run(0)) - tailRmsDb(await run(-10))).toBeCloseTo(10, 0);
  });

  it('오실레이터: 핑크 노이즈를 메인에 정한 크기(RMS)로 넣는다', async () => {
    const out = await renderMixer({
      freq: 1000,
      db: -20,
      shape: { channels: 1, inputs: [{ label: 'IN 1', stemId: null }] },
      prepare: ({ store }) => store.getState().actions.setOsc({ on: true, type: 'pink', levelDb: -20, target: 'main' }),
    });
    expect(tailRmsDb(out)).toBeCloseTo(-20, 0);
  });
});
