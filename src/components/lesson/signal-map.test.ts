// 신호 흐름 지도 검사: 지도가 자라는 순서가 강의 순서와 맞는지, 원고가 부르는 레슨 id가 있는지, 칸이 겹치지 않는지.
import { describe, expect, it } from 'vitest';
import { STEPS, WIDTH, describeSignalMap, isStep, layoutSignalMap } from './signal-map';

const files = import.meta.glob<string>('../../content/lessons/*/*.mdx', { query: '?raw', import: 'default', eager: true });
const lessons = Object.entries(files)
  .map(([path, text]) => ({
    id: path.replace('../../content/lessons/', '').replace(/\.mdx$/, ''),
    chapter: Number(path.match(/lessons\/(\d+)-/)![1]),
    order: Number(text.match(/^order:\s*(\d+)/m)![1]),
    text,
  }))
  .sort((a, b) => a.chapter - b.chapter || a.order - b.order);

const overlap = (a: { x: number; y: number; r: number; b: number }, b: typeof a) => a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;

describe('신호 흐름 지도', () => {
  it('STEPS는 모두 있는 레슨이고 강의 순서대로다', () => {
    const order = lessons.map((l) => l.id);
    for (const s of STEPS) expect(order).toContain(s);
    const idx = STEPS.map((s) => order.indexOf(s));
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });

  it('원고의 <SignalMap at>은 STEPS에 있고, 그 레슨 자신을 가리킨다', () => {
    const uses = lessons.flatMap((l) => [...l.text.matchAll(/<SignalMap\s+at="([^"]+)"/g)].map((m) => ({ lesson: l.id, at: m[1] })));
    expect(uses.length).toBeGreaterThan(5);
    for (const u of uses) {
      expect(isStep(u.at), u.at).toBe(true);
      expect(u.at).toBe(u.lesson);
    }
  });

  it('모르는 레슨 id는 빌드에서 바로 알린다', () => {
    expect(() => layoutSignalMap('02-processing/99-nope')).toThrow(/모르는 레슨/);
  });

  it.each(STEPS)('%s: 칸끼리 겹치지 않고 폭 안에 들어간다', (s) => {
    const l = layoutSignalMap(s);
    const boxes = [...l.nodes, l.proc];
    for (let i = 0; i < boxes.length; i++) {
      expect(boxes[i].x).toBeGreaterThanOrEqual(0);
      expect(boxes[i].r).toBeLessThanOrEqual(WIDTH);
      expect(boxes[i].b).toBeLessThanOrEqual(l.height);
      for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i], boxes[j]), `${boxes[i]} ${boxes[j]}`).toBe(false);
    }
    for (const c of l.chips) expect(c.b).toBeLessThanOrEqual(l.proc.b);
  });

  it.each(STEPS)('%s: 선은 꺾일 때 가로·세로로만 간다', (s) => {
    for (const e of layoutSignalMap(s).edges) {
      for (let i = 1; i < e.points.length; i++) {
        const [[x0, y0], [x1, y1]] = [e.points[i - 1], e.points[i]];
        expect(x0 === x1 || y0 === y1, e.id).toBe(true);
      }
    }
  });

  it('레슨을 넘길수록 지도가 자라거나, 이미 있는 칸을 다시 강조한다', () => {
    let prev = 0;
    for (const s of STEPS) {
      const l = layoutSignalMap(s);
      expect(l.learned).toBeGreaterThanOrEqual(prev);
      if (s !== STEPS[0]) {
        const highlighted = [...l.nodes, ...l.chips].some((n) => n.state === 'new' || n.state === 'focus') || l.nodes.some((n) => n.badge?.state === 'new');
        expect(highlighted, s).toBe(true);
      }
      prev = l.learned;
    }
    expect(prev).toBe(layoutSignalMap(STEPS.at(-1)!).total);
  });

  it('첫 지도는 마이크에서 메인·모니터까지 두 갈래만 보인다', () => {
    const l = layoutSignalMap(STEPS[0]);
    expect(l.nodes.map((n) => n.id).sort()).toEqual(['fader', 'foh', 'main', 'mic', 'mon', 'pre', 'stage']);
    expect(l.chips.every((c) => c.state === 'named')).toBe(true);
    expect(describeSignalMap(l)).toContain('마이크 → 프리엠프');
  });

  it('리버브 레슨부터 FX가 나갔다가 메인으로 돌아온다', () => {
    const before = layoutSignalMap('02-processing/06-gate');
    const after = layoutSignalMap('02-processing/07-reverb-delay');
    expect(before.edges.find((e) => e.id === 'rev-main')).toBeUndefined();
    const ret = after.edges.find((e) => e.id === 'rev-main')!;
    expect(ret.state).toBe('new');
    expect(ret.to).toBe('main');
  });
});
