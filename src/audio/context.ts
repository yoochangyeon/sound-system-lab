// 페이지 하나에 AudioContext 하나. 브라우저 자동재생 정책 때문에
// 사용자 클릭 이후에 getAudioContext()를 처음 불러야 한다.
let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

const bufferCache = new Map<string, Promise<AudioBuffer>>();

/** public/audio/ 아래 샘플을 불러와 디코딩한다. */
export function loadSample(path: string): Promise<AudioBuffer> {
  let p = bufferCache.get(path);
  if (!p) {
    p = fetch(path)
      .then((res) => {
        if (!res.ok) throw new Error(`샘플 로드 실패: ${path} (${res.status})`);
        return res.arrayBuffer();
      })
      .then((buf) => getAudioContext().decodeAudioData(buf));
    bufferCache.set(path, p);
  }
  return p;
}
