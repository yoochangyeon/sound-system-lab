// 신호 흐름 지도(SignalMap)의 데이터와 배치 계산.
// 칸·선마다 처음 배우는 레슨(since)을 적어 두면, 레슨을 넘길수록 지도가 한 칸씩 자란다.
// 처리 순서는 쉬운 믹서 엔진(src/audio/channel-strip.ts)과 같다:
// 프리엠프 → HPF → 게이트 → EQ → 컴프 → Insert → 페이더. 모니터 센드는 페이더 앞, FX·그룹·메인은 페이더 뒤.

/** 지도가 자라는 레슨. 강의 순서대로 적는다(signal-map.test.ts가 원고 순서와 대조한다). */
export const STEPS = [
  '01-basics/01-signal-flow',
  '02-processing/01-preamp',
  '02-processing/02-eq-basics',
  '02-processing/03-peq-hpf',
  '02-processing/04-geq-feedback',
  '02-processing/05-compressor',
  '02-processing/06-gate',
  '02-processing/07-reverb-delay',
  '02-processing/08-insert-send',
  '02-processing/09-sidechain-deesser',
  '02-processing/10-expander',
  '03-consoles/04-buses-dca',
] as const;
export type Step = (typeof STEPS)[number];

/** 색 묶음. tokens.css의 --fn-* 와 짝이다. */
export type Kind = 'src' | 'pre' | 'eq' | 'dyn' | 'fx' | 'bus' | 'out';

interface NodeDef {
  id: string;
  name: string;
  sub?: string;
  kind: Kind;
  col: 0 | 1 | 2;
  row: number;
  since: Step;
  /** 오른쪽 위 작은 표(예: GEQ) */
  badge?: { text: string; kind: Kind; since: Step };
}

interface ChipDef {
  id: string;
  name: string;
  kind: Kind;
  /** 이름만 먼저 나오는 레슨(흐리게) */
  named: Step;
  /** 직접 만져 보는 레슨(색이 들어간다) */
  since: Step;
  /** 같은 자리에 붙는 처리기(예: 게이트 · 익스팬더) */
  extra?: { name: string; since: Step };
  /** 처리기가 아니라 자리 표시(칸 수에 넣지 않는다) */
  slot?: boolean;
}

type Pt = [number, number];
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  b: number;
  cx: number;
  cy: number;
}
interface Ctx {
  n: (id: string) => Box;
  /** 게이트 칩의 세로 중심(사이드체인 키가 들어가는 곳) */
  gateY: number;
}

export type EdgeKind = 'sig' | 'fx' | 'key';
interface EdgeDef {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  since: Step;
  route: (c: Ctx) => Pt[];
  /** 갈라지는 점(●)을 그릴 곳: 경로의 몇 번째 점 */
  junction?: number;
  label?: { text: string; since: Step; at: (c: Ctx) => Pt; end?: boolean };
}

const [S1, PRE, EQB, PEQ, GEQ, COMP, GATE, FX, INS, SC, EXP, BUS] = STEPS;

const NODES: NodeDef[] = [
  { id: 'mic', name: '마이크', sub: '소리 → 전기', kind: 'src', col: 0, row: 1, since: S1 },
  { id: 'key', name: '목소리 채널', sub: '키로 듣는다', kind: 'src', col: 1, row: 1, since: SC },
  { id: 'pre', name: '프리엠프', sub: '게인', kind: 'pre', col: 0, row: 2, since: S1 },
  { id: 'ins', name: 'Insert', sub: '나갔다 돌아옴', kind: 'fx', col: 1, row: 3, since: INS },
  { id: 'fader', name: '페이더', sub: '내보낼 크기', kind: 'pre', col: 0, row: 4, since: S1 },
  { id: 'mon', name: '모니터 버스', sub: 'Aux', kind: 'bus', col: 1, row: 4, since: S1 },
  { id: 'stage', name: '무대 모니터', sub: '찬양팀이 듣는다', kind: 'out', col: 2, row: 4, since: S1, badge: { text: 'GEQ', kind: 'eq', since: GEQ } },
  { id: 'fxbus', name: 'FX 버스', sub: '복사본이 모임', kind: 'fx', col: 1, row: 5, since: FX },
  { id: 'rev', name: '리버브·딜레이', sub: '잔향·메아리', kind: 'fx', col: 2, row: 5, since: FX },
  { id: 'grp', name: '그룹 버스', sub: '드럼 묶음', kind: 'bus', col: 1, row: 6, since: BUS },
  { id: 'main', name: '메인 버스', sub: '모두 모인다', kind: 'bus', col: 1, row: 7, since: S1 },
  { id: 'foh', name: '회중석', sub: '메인 스피커', kind: 'out', col: 2, row: 7, since: S1, badge: { text: 'GEQ', kind: 'eq', since: GEQ } },
  { id: 'mtx', name: '매트릭스', sub: '다시 섞어 보냄', kind: 'bus', col: 1, row: 8, since: BUS },
  { id: 'lobby', name: '로비 스피커', sub: '로비 균형', kind: 'out', col: 2, row: 8, since: BUS },
];

/** 채널 처리 상자 안의 칸. 1장에서 이름을 먼저 배우고 2장에서 하나씩 만진다. */
const CHIPS: ChipDef[] = [
  { id: 'hpf', name: 'HPF', kind: 'eq', named: S1, since: EQB },
  { id: 'gate', name: '게이트', kind: 'dyn', named: S1, since: GATE, extra: { name: '익스팬더', since: EXP } },
  { id: 'eq', name: 'EQ', kind: 'eq', named: S1, since: EQB },
  { id: 'comp', name: '컴프', kind: 'dyn', named: S1, since: COMP, extra: { name: '디에서', since: SC } },
  { id: 'ins-pt', name: 'Insert 자리', kind: 'fx', named: INS, since: INS, slot: true },
];

// 배치 치수(SVG 좌표 = 휴대폰에서 거의 1:1)
export const WIDTH = 360;
const COLS = [
  { x: 4, w: 112 },
  { x: 134, w: 100 },
  { x: 252, w: 104 },
];
const LANE1 = 125; // 채널 열과 버스 열 사이 세로 길
const GAP = 32;
const NODE_H = 44;
const PROC_HEAD = 24;
const CHIP_H = 22;
const TOP = 6;

const EDGES: EdgeDef[] = [
  { id: 'mic-pre', from: 'mic', to: 'pre', kind: 'sig', since: S1, route: ({ n }) => down(n('mic'), n('pre')) },
  { id: 'pre-proc', from: 'pre', to: 'proc', kind: 'sig', since: S1, route: ({ n }) => down(n('pre'), n('proc')) },
  { id: 'proc-fader', from: 'proc', to: 'fader', kind: 'sig', since: S1, route: ({ n }) => down(n('proc'), n('fader')) },
  {
    id: 'tap-mon',
    from: 'proc',
    to: 'mon',
    kind: 'sig',
    since: S1,
    junction: 0,
    route: ({ n }) => {
      const p = n('proc');
      const g = tapY(p, n('fader'));
      const m = n('mon');
      return [[p.cx, g], [LANE1, g], [LANE1, m.cy], [m.x, m.cy]];
    },
    label: { text: '페이더 앞', since: INS, at: ({ n }) => [n('proc').cx + 6, tapY(n('proc'), n('fader')) - 5] },
  },
  { id: 'mon-stage', from: 'mon', to: 'stage', kind: 'sig', since: S1, route: ({ n }) => right(n('mon'), n('stage')) },
  { id: 'fader-main', from: 'fader', to: 'main', kind: 'sig', since: S1, route: ({ n }) => trunk(n('fader'), n('main')) },
  {
    id: 'fader-fx',
    from: 'fader',
    to: 'fxbus',
    kind: 'fx',
    since: FX,
    junction: 1,
    route: ({ n }) => trunk(n('fader'), n('fxbus')),
    label: { text: '페이더 뒤', since: INS, at: ({ n }) => [n('fader').cx + 6, n('fxbus').cy - 5] },
  },
  { id: 'fx-rev', from: 'fxbus', to: 'rev', kind: 'fx', since: FX, route: ({ n }) => right(n('fxbus'), n('rev')) },
  {
    id: 'rev-main',
    from: 'rev',
    to: 'main',
    kind: 'fx',
    since: FX,
    route: ({ n }) => {
      const r = n('rev');
      const m = n('main');
      const y = m.y - GAP / 2;
      return [[r.cx, r.b], [r.cx, y], [m.r - 20, y], [m.r - 20, m.y]];
    },
    label: { text: '돌아옴', since: FX, end: true, at: ({ n }) => [n('rev').cx - 6, n('main').y - GAP / 2 - 5] },
  },
  { id: 'main-foh', from: 'main', to: 'foh', kind: 'sig', since: S1, route: ({ n }) => right(n('main'), n('foh')) },
  {
    id: 'ins-out',
    from: 'proc',
    to: 'ins',
    kind: 'fx',
    since: INS,
    route: ({ n }) => [[n('proc').r, n('ins').cy - 6], [n('ins').x, n('ins').cy - 6]],
  },
  {
    id: 'ins-ret',
    from: 'ins',
    to: 'proc',
    kind: 'fx',
    since: INS,
    route: ({ n }) => [[n('ins').x, n('ins').cy + 6], [n('proc').r, n('ins').cy + 6]],
  },
  {
    id: 'key',
    from: 'key',
    to: 'proc',
    kind: 'key',
    since: SC,
    route: ({ n, gateY }) => {
      const k = n('key');
      return [[k.x, k.cy], [LANE1, k.cy], [LANE1, gateY], [n('proc').r, gateY]];
    },
    label: { text: '키', since: SC, at: ({ n }) => [LANE1 + 5, n('pre').cy + 4] },
  },
  { id: 'fader-grp', from: 'fader', to: 'grp', kind: 'sig', since: BUS, junction: 1, route: ({ n }) => trunk(n('fader'), n('grp')) },
  { id: 'grp-main', from: 'grp', to: 'main', kind: 'sig', since: BUS, route: ({ n }) => down(n('grp'), n('main')) },
  { id: 'main-mtx', from: 'main', to: 'mtx', kind: 'sig', since: BUS, route: ({ n }) => down(n('main'), n('mtx')) },
  { id: 'mtx-lobby', from: 'mtx', to: 'lobby', kind: 'sig', since: BUS, route: ({ n }) => right(n('mtx'), n('lobby')) },
];

/** 레슨마다 강조할 칸과 지도 아래 한 줄. 새로 생긴 칸은 따로 적지 않아도 강조된다. */
const STEP_INFO: Record<Step, { focus?: string[]; note: string }> = {
  [S1]: { note: '채널 하나의 소리가 ● 에서 갈라져 모니터와 메인 두 곳으로 나간다. 채널 여덟 개가 모두 이 길을 지나 버스에서 모인다. 흐린 칸은 2장에서 하나씩 만진다.' },
  [PRE]: { focus: ['pre'], note: '모든 처리의 출발점이다. 여기서 기본 크기를 잡아야 뒤의 처리와 페이더가 제 몫을 한다.' },
  [EQB]: { note: 'HPF와 EQ가 채널 처리 안에 자리를 잡았다. 둘 다 높낮이별 크기를 다듬는다.' },
  [PEQ]: { focus: ['hpf', 'eq'], note: 'HPF로 바닥을 먼저 정리하고, EQ로 먹먹한 대역을 던다.' },
  [GEQ]: { note: 'GEQ는 채널이 아니라 출력에 건다. 그 스피커에서 터지는 하울링을 잡는다.' },
  [COMP]: { note: '컴프는 EQ 다음에서 큰 소리만 누른다. 콘솔에 따라 EQ와 순서를 바꿀 수 있다.' },
  [GATE]: { note: '게이트는 EQ 앞에서 작은 소리(블리드)를 닫는다.' },
  [FX]: { note: '원음은 메인으로 바로 가고, 복사본이 FX 버스 → 리버브를 거쳐 메인으로 돌아온다.' },
  [INS]: { focus: ['fxbus', 'rev'], note: 'Insert는 채널 소리 전체가 나갔다 돌아온다. 모니터는 보통 페이더 앞, FX는 보통 페이더 뒤에서 떼어 보낸다.' },
  [SC]: { note: '목소리 채널은 키로 "듣기만" 한다. 소리는 섞이지 않고, 이 채널의 다이내믹스만 움직인다.' },
  [EXP]: { focus: ['gate'], note: '익스팬더는 게이트 자리에서 작은 소리를 조금씩 줄인다.' },
  [BUS]: {
    note: '같은 소리가 메인으로 바로, 또는 그룹을 거쳐 메인으로 간다. 매트릭스는 메인을 다시 섞어 로비로 보낸다. DCA는 소리 길이 없어 지도에 없다.',
  },
};

// ── 경로 도우미 ─────────────────────────────────────────────

function down(a: Box, b: Box): Pt[] {
  return [[a.cx, a.b], [a.cx, b.y]];
}
function right(a: Box, b: Box): Pt[] {
  return [[a.r, a.cy], [b.x, b.cy]];
}
/** 페이더 아래로 내려가다 오른쪽 버스로 꺾는 줄기(페이더 뒤) */
function trunk(fader: Box, bus: Box): Pt[] {
  return [[fader.cx, fader.b], [fader.cx, bus.cy], [bus.x, bus.cy]];
}
function tapY(proc: Box, fader: Box): number {
  return (proc.b + fader.y) / 2;
}
function box(x: number, y: number, w: number, h: number): Box {
  return { x, y, w, h, r: x + w, b: y + h, cx: x + w / 2, cy: y + h / 2 };
}

// ── 배치 ────────────────────────────────────────────────────

/** 칸의 상태: 아직 없음 · 이름만(흐림) · 배움 · 이번에 강조 */
export type State = 'hidden' | 'named' | 'known' | 'new' | 'focus';

export interface PlacedNode extends Box {
  id: string;
  name: string;
  sub?: string;
  kind: Kind;
  state: State;
  badge?: { text: string; kind: Kind; state: State };
}
export interface PlacedChip extends Box {
  id: string;
  name: string;
  kind: Kind;
  state: State;
}
export interface PlacedEdge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  state: State;
  points: Pt[];
  junction?: Pt;
  label?: { text: string; x: number; y: number; end: boolean; state: State };
}
export interface SignalMapLayout {
  width: number;
  height: number;
  nodes: PlacedNode[];
  proc: Box & { state: State };
  chips: PlacedChip[];
  edges: PlacedEdge[];
  /** '콘솔 채널' 테두리 */
  channel: Box;
  note: string;
  learned: number;
  total: number;
}

export function isStep(at: string): at is Step {
  return (STEPS as readonly string[]).includes(at);
}

export function layoutSignalMap(at: string): SignalMapLayout {
  if (!isStep(at)) throw new Error(`SignalMap: 모르는 레슨 "${at}". signal-map.ts의 STEPS에 있는 id를 쓴다.`);
  const now = STEPS.indexOf(at);
  const reached = (s: Step) => STEPS.indexOf(s) <= now;
  const info = STEP_INFO[at];
  const first = now === 0;
  const stateOf = (id: string, since: Step): State => {
    if (!reached(since)) return 'hidden';
    if (since === at && !first) return 'new';
    if (info.focus?.includes(id)) return 'focus';
    return 'known';
  };

  // 채널 처리 상자의 칸
  const chipDefs = CHIPS.filter((c) => reached(c.named));
  const procH = PROC_HEAD + chipDefs.length * CHIP_H + 6;

  // 행 높이: 그 행에 보이는 칸 중 가장 큰 것. 빈 행은 접는다.
  const visible = NODES.filter((d) => reached(d.since));
  const rowNos = [...new Set([...visible.map((d) => d.row), 3])].sort((a, b) => a - b);
  const rowY = new Map<number, { y: number; h: number }>();
  let y = TOP;
  for (const r of rowNos) {
    const h = r === 3 ? procH : NODE_H;
    // 2행 위에는 '콘솔 채널' 글씨 자리가 있다(GAP 안에 들어간다)
    rowY.set(r, { y, h });
    y += h + GAP;
  }
  const height = y - GAP + TOP;

  const boxes = new Map<string, Box>();
  const procRow = rowY.get(3)!;
  const proc = box(COLS[0].x, procRow.y, COLS[0].w, procRow.h);
  boxes.set('proc', proc);

  const nodes: PlacedNode[] = visible.map((d) => {
    const row = rowY.get(d.row)!;
    const col = COLS[d.col];
    // Insert는 컴프 뒤 'Insert 자리'(처리 상자 맨 아래 칸) 옆에 둔다
    const ny = d.id === 'ins' ? proc.b - 6 - (CHIP_H - 4) / 2 - NODE_H / 2 : row.y + (row.h - NODE_H) / 2;
    const b = box(col.x, ny, col.w, NODE_H);
    boxes.set(d.id, b);
    const badge = d.badge && reached(d.badge.since) ? { text: d.badge.text, kind: d.badge.kind, state: stateOf(d.id, d.badge.since) } : undefined;
    return { ...b, id: d.id, name: d.name, sub: d.sub, kind: d.kind, state: stateOf(d.id, d.since), badge };
  });

  const chips: PlacedChip[] = chipDefs.map((c, i) => {
    const b = box(proc.x + 6, proc.y + PROC_HEAD + i * CHIP_H, proc.w - 12, CHIP_H - 4);
    const learned = reached(c.since);
    const extra = c.extra && reached(c.extra.since) ? c.extra : undefined;
    let state: State = learned ? stateOf(c.id, c.since) : 'named';
    if (extra && extra.since === at) state = 'new';
    return { ...b, id: c.id, name: extra ? `${c.name}·${extra.name}` : c.name, kind: c.kind, state };
  });
  const gateChip = chips.find((c) => c.id === 'gate');
  const ctx: Ctx = {
    n: (id) => {
      const b = boxes.get(id);
      if (!b) throw new Error(`SignalMap: "${id}" 칸이 아직 없다`);
      return b;
    },
    gateY: gateChip ? gateChip.cy : proc.cy,
  };

  const edges: PlacedEdge[] = EDGES.filter((e) => reached(e.since)).map((e) => {
    const points = e.route(ctx);
    const label = e.label && reached(e.label.since) ? (() => {
      const [lx, ly] = e.label!.at(ctx);
      return { text: e.label!.text, x: lx, y: ly, end: !!e.label!.end, state: stateOf(e.id, e.label!.since) };
    })() : undefined;
    return {
      id: e.id,
      from: e.from,
      to: e.to,
      kind: e.kind,
      state: stateOf(e.id, e.since),
      points,
      junction: e.junction === undefined ? undefined : points[e.junction],
      label,
    };
  });

  const pre = ctx.n('pre');
  const fader = ctx.n('fader');
  const channel = box(0, pre.y - 22, COLS[0].x * 2 + COLS[0].w, fader.b + 8 - (pre.y - 22));

  const counted = (id: string) => !CHIPS.find((c) => c.id === id)?.slot;
  const total = NODES.length + CHIPS.filter((c) => !c.slot).length;
  const learned = nodes.length + chips.filter((c) => c.state !== 'named' && counted(c.id)).length;

  return {
    width: WIDTH,
    height,
    nodes,
    proc: { ...proc, state: 'known' },
    chips,
    edges,
    channel,
    note: info.note,
    learned,
    total,
  };
}

/** 화면 읽기 프로그램용 한 줄 요약 */
export function describeSignalMap(l: SignalMapLayout): string {
  const name = (id: string) => (id === 'proc' ? `채널 처리(${l.chips.map((c) => c.name).join(' → ')})` : l.nodes.find((n) => n.id === id)?.name ?? id);
  const paths = l.edges.filter((e) => e.kind !== 'key').map((e) => `${name(e.from)} → ${name(e.to)}`);
  const keys = l.edges.filter((e) => e.kind === 'key').map((e) => `${name(e.from)}는 키로 ${name(e.to)}에 연결`);
  return `신호 흐름 지도. ${[...paths, ...keys].join(', ')}. ${l.note}`;
}
