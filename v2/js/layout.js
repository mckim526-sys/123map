// 관계도 배치 계산. 좌표는 모두 그래프 영역 대비 % 단위.
const Layout = (() => {
  const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // 황금각 (해바라기 배치)
  const CX = 450, CY = 292;                    // 시뮬레이션 공간 중심 (900×584)

  // 결정적(deterministic) 힘 기반 배치: 같은 데이터 → 항상 같은 그림
  function forceLayout(list, rootId, scope) {
    const root = list.find(p => p.id === rootId) || list[0];
    if (!root) return { positions: [], edges: [] };
    const order = [root, ...list.filter(p => p !== root)];
    const n = order.length;
    const pts = order.map((p, i) => {
      const r = Math.sqrt(i / Math.max(1, n - 1)), t = (i - 1) * GOLDEN;
      return { p, x: i ? CX + 360 * r * Math.cos(t) : CX, y: i ? CY + 235 * r * Math.sin(t) : CY, deg: 0 };
    });

    const links = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (!Model.linkLabel(pts[i].p, pts[j].p, scope)) continue;
      const strong = Model.triedTogether(pts[i].p, pts[j].p, scope);
      links.push({ i, j, strong });
      pts[i].deg++; pts[j].deg++;
    }

    for (let step = 0; step < 420; step++) {
      const f = pts.map(v => ({ x: (CX - v.x) * 0.006, y: (CY - v.y) * 0.006 }));
      // 서로 밀어내기 — 이름표 겹침 방지
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        let dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
        if (!dx && !dy) dx = 1;
        const d = Math.max(1, Math.hypot(dx, dy)), push = Math.min(15, 1900 / (d * d));
        f[i].x -= dx / d * push; f[i].y -= dy / d * push;
        f[j].x += dx / d * push; f[j].y += dy / d * push;
      }
      // 연결선은 용수철 — 같은 재판은 더 가깝게
      for (const { i, j, strong } of links) {
        const dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y, d = Math.max(1, Math.hypot(dx, dy));
        const rest = strong ? 78 : (i === 0 || j === 0) ? 145 : 95;
        const k = (d - rest) * (strong ? 0.022 : 0.014);
        f[i].x += dx / d * k; f[i].y += dy / d * k;
        f[j].x -= dx / d * k; f[j].y -= dy / d * k;
      }
      for (let i = 1; i < n; i++) {
        pts[i].x = clamp(pts[i].x + clamp(f[i].x, -5, 5), 50, 850);
        pts[i].y = clamp(pts[i].y + clamp(f[i].y, -5, 5), 50, 550);
      }
    }

    // 퍼센트 좌표로 정규화
    const sx = 400 / Math.max(1, ...pts.map(v => Math.abs(v.x - CX)));
    const sy = 245 / Math.max(1, ...pts.map(v => Math.abs(v.y - CY)));
    const positions = pts.map((v, i) => ({
      p: v.p, x: 50 + (v.x - CX) * sx / 9, y: 47 + (v.y - CY) * sy / 6.2, major: i === 0 || v.deg >= 3,
    }));

    // 최소 신장 숲: 같은 재판 연결을 먼저, 그다음 가까운 순으로 — 중복선 없이 간접 연결 유지
    const parent = pts.map((_, i) => i);
    const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
    const cost = l => (l.strong ? 0 : 1e4) + Math.hypot(pts[l.i].x - pts[l.j].x, pts[l.i].y - pts[l.j].y);
    const edges = [];
    links.sort((a, b) => cost(a) - cost(b)).forEach(l => {
      const ra = find(l.i), rb = find(l.j);
      if (ra !== rb) { parent[ra] = rb; edges.push([positions[l.i], positions[l.j]]); }
    });
    return { positions, edges };
  }

  // 점+이름표 상자 전체가 겹치지 않도록 재배치 (픽셀 단위)
  function resolveOverlaps(positions, rootId, W, H, boxes) {
    // 좁은 화면(모바일)은 여백·간격을 줄이고 더 촘촘히 빈자리를 찾음
    const narrow = W < 500;
    const PAD = narrow ? 4 : 8, GAP = narrow ? 2 : 7, STEP = narrow ? 4 : 8;
    const items = positions.map((v, i) => ({ v, i, x: v.x * W / 100, y: v.y * H / 100, b: boxes[i] }));
    const fit = it => {
      it.x = clamp(it.x, PAD - it.b.left, W - PAD - it.b.right);
      it.y = clamp(it.y, PAD - it.b.top, H - PAD - it.b.bottom);
    };
    const hit = (a, c) => a.x + a.b.right + GAP > c.x + c.b.left && c.x + c.b.right + GAP > a.x + a.b.left
      && a.y + a.b.bottom + GAP > c.y + c.b.top && c.y + c.b.bottom + GAP > a.y + a.b.top;

    // 중심 인물 → 주요 인물 → 나머지 순으로 자리를 확정
    const rank = it => (it.v.p.id === rootId ? 2 : 0) + (it.v.major ? 1 : 0);
    const queue = [...items].sort((a, c) => rank(c) - rank(a) || a.i - c.i);
    const placed = [];
    for (const it of queue) {
      fit(it);
      if (placed.some(o => hit(it, o))) {
        const ox = it.x, oy = it.y;
        let best = null, bestD = Infinity;
        for (let y = PAD - it.b.top; y <= H - PAD - it.b.bottom; y += STEP) {
          for (let x = PAD - it.b.left; x <= W - PAD - it.b.right; x += STEP) {
            const d = (x - ox) ** 2 + (y - oy) ** 2;
            if (d >= bestD) continue;
            const cand = { x, y, b: it.b };
            if (!placed.some(o => hit(cand, o))) { best = cand; bestD = d; }
          }
        }
        if (best) { it.x = best.x; it.y = best.y; }
        // 좁은 화면에서 이름표까지 둘 자리가 없으면 아바타만 두고 이름표는 숨김(compact)
        else if (narrow && it.b.dot) {
          const small = it.b.dot;
          let bd = Infinity, spot = null;
          for (let y = PAD - small.top; y <= H - PAD - small.bottom; y += STEP) {
            for (let x = PAD - small.left; x <= W - PAD - small.right; x += STEP) {
              const d = (x - ox) ** 2 + (y - oy) ** 2;
              if (d >= bd) continue;
              if (!placed.some(o => hit({ x, y, b: small }, o))) { spot = { x, y }; bd = d; }
            }
          }
          if (spot) { it.x = spot.x; it.y = spot.y; it.b = small; it.v.compact = true; }
        }
      }
      placed.push(it);
      it.v.x = it.x / W * 100; it.v.y = it.y / H * 100;
    }
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  return { forceLayout, resolveOverlaps, GOLDEN };
})();
