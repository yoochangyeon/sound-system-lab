#!/usr/bin/env python3
"""멀티트랙으로 실습용 곡 소스를 만든다(음원 라이브러리 #45, 사용법: docs/audio-pipeline.md).

    python3 tools/make-song.py tools/songs/<곡>.json <원본 WAV 폴더> [원곡 믹스 폴더]

- 박(beatPhaseSec, bpm)과 시작 박(startBeat)부터 beats박을 잘라 루프를 만든다.
- groups의 트랙들을 모노로 더해 소스 하나로 만든다. 0 dBFS를 넘으면 −3 dBFS 피크로 낮춘다.
- 양 끝 5 ms 페이드, AAC 96 kbps(정답 믹스는 스테레오 160 kbps)로 public/audio/songs/<id>/에 쓴다.
- 매니페스트에 옮겨 적을 피크·RMS를 출력한다.
macOS의 afconvert와 파이썬 표준 라이브러리만 쓴다.
"""
import array, json, math, os, struct, subprocess, sys, tempfile, wave

SR = 44100
FADE = round(0.005 * SR)


def decode(src, dst, ch):
    subprocess.run(['afconvert', '-f', 'WAVE', '-d', f'LEF32@{SR}', '-c', str(ch), src, dst], check=True)


def read_f32(path):
    b = open(path, 'rb').read()
    i = 12
    while i < len(b):
        cid = b[i:i + 4]
        size = struct.unpack('<I', b[i + 4:i + 8])[0]
        if cid == b'data':
            a = array.array('f')
            a.frombytes(b[i + 8:i + 8 + size])
            return a
        i += 8 + size + (size & 1)
    raise SystemExit('data 청크 없음: ' + path)


def db(x):
    return 20 * math.log10(x) if x > 0 else -120.0


def stats(a, ch=1):
    peak = max(abs(x) for x in a)
    w = round(0.05 * SR) * ch
    vals = []
    for i in range(0, len(a) - w, w):
        seg = a[i:i + w:2]
        r = math.sqrt(sum(x * x for x in seg) / len(seg))
        if r > 10 ** (-60 / 20):
            vals.append(r)
    rms = math.sqrt(sum(v * v for v in vals) / len(vals)) if vals else 0
    return round(db(peak), 1), round(db(rms), 1)


def fade(a, ch=1):
    for i in range(FADE * ch):
        g = (i // ch) / FADE
        a[i] *= g
        a[-1 - i] *= g


def write_m4a(a, ch, dst, kbps):
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as t:
        tmp = t.name
    w = wave.open(tmp, 'wb')
    w.setnchannels(ch)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(array.array('h', (max(-32767, min(32767, int(round(x * 32767)))) for x in a)).tobytes())
    w.close()
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', str(kbps * 1000), tmp, dst], check=True)
    os.remove(tmp)


def main():
    cfg = json.load(open(sys.argv[1]))
    src_dir = sys.argv[2]
    ref_dir = sys.argv[3] if len(sys.argv) > 3 else src_dir
    out = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio', 'songs', cfg['id'])
    os.makedirs(out, exist_ok=True)
    beat = 60 / cfg['bpm']
    t0 = cfg['beatPhaseSec'] + cfg['startBeat'] * beat
    n = round(cfg['beats'] * beat * SR)
    start = round(t0 * SR)
    tmpdir = tempfile.mkdtemp()
    for key, files in cfg['groups'].items():
        acc = None
        for f in files:
            p = os.path.join(tmpdir, f + '.wav')
            decode(os.path.join(src_dir, f + '.wav'), p, 1)
            seg = read_f32(p)[start:start + n]
            if len(seg) < n:
                seg.extend([0.0] * (n - len(seg)))
            acc = seg if acc is None else array.array('f', (x + y for x, y in zip(acc, seg)))
        pk, _ = stats(acc)
        gain = 0.0
        if pk > -1.0:
            gain = -3.0 - pk
            g = 10 ** (gain / 20)
            acc = array.array('f', (x * g for x in acc))
        fade(acc)
        pk, rms = stats(acc)
        write_m4a(acc, 1, os.path.join(out, key + '.m4a'), 96)
        print(json.dumps({'key': key, 'peakDb': pk, 'rmsDb': rms, 'gainDb': round(gain, 1), 'from': files}, ensure_ascii=False))
    if cfg.get('reference'):
        p = os.path.join(tmpdir, 'reference.wav')
        decode(os.path.join(ref_dir, cfg['reference']), p, 2)
        rs = round((t0 + cfg.get('referenceOffsetSec', 0)) * SR) * 2
        seg = read_f32(p)[rs:rs + n * 2]
        fade(seg, 2)
        pk, rms = stats(seg, 2)
        write_m4a(seg, 2, os.path.join(out, 'reference.m4a'), 160)
        print(json.dumps({'key': 'reference', 'peakDb': pk, 'rmsDb': rms}))
    print(json.dumps({'fromSec': round(t0, 3), 'toSec': round(t0 + n / SR, 3), 'loopSeconds': round(n / SR, 3)}))


if __name__ == '__main__':
    main()
