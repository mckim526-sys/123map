// 관계도 화면
const MapView = (() => {
  const graph = $('#graph'), nodeLayer = $('#nodeLayer'), edgeLayer = $('#edgeLayer'), groupLayer = $('#groupLayer');
  // 연결 이름을 묶음 제목으로 줄임 ("체포영장 집행 방해 · 별도 재판" → "체포영장 집행 방해")
  const shortLabel = t => String(t || '').split(' · ')[0];

  // ── 배치 계산 ──────────────────────────────────
  // 중심 인물 배치(첫 화면·인물 선택): 중심 인물의 사건마다 그 사건 사람들을 한 무리로 모으고 사건 뱃지를 붙임.
  // 배치는 상세에서 어떤 사건을 보고 있든 같음 (오른쪽 상세가 왼쪽 배치를 바꾸지 않음).
  //  · 함께 재판받는 사람이 있는 사건: 무리 + 뱃지 "사건명 N"
  //  · 단독 재판 사건: 사람 없이 뱃지만 "사건명 · 단독"
  //  · 사건이 아닌 관계(가족·별도 관계): "그 밖의 관계" 무리
  //  · 한 사람이 여러 사건에 걸치면 첫 무리에 놓고, 강조할 때는 모든 사건에 포함
  function caseLayout(S, list, center) {
    const inList = new Set(list.map(p => p.id));
    const recs = center.records.filter(r => S.agency === 'all' || r.agency === S.agency);
    const cases = recs.map(r => ({
      id: r.id, label: shortLabel(r.label), agency: r.agency,
      ids: [...Model.trialmates(center, r)].filter(id => inList.has(id)),
    }));
    const placed = new Set(), clusters = [];
    [...cases].sort((a, b) => b.ids.length - a.ids.length).forEach(c => {
      const own = c.ids.filter(id => !placed.has(id));
      own.forEach(id => placed.add(id));
      clusters.push({ ...c, place: own.map(id => Model.get(id)) });
    });
    const coIds = new Set(cases.flatMap(c => c.ids));
    const others = list.filter(p => p.id !== center.id && !coIds.has(p.id) && Model.linkLabel(center, p, S.agency));
    if (others.length) clusters.push({ id: '', label: '그 밖의 관계', other: true, ids: others.map(p => p.id), place: others });

    // 원 둘레에 무리를 이어 붙임 (단독 사건은 빈 자리 하나, 무리 사이 한 칸)
    const seq = [];
    clusters.forEach(c => {
      if (seq.length) seq.push(null);
      c.from = seq.length;
      if (c.place.length) seq.push(...c.place); else seq.push(null);
      c.to = seq.length - 1;
    });
    if (seq.length > 1) seq.push(null);
    const n = Math.max(seq.length, 6);
    const ang = i => -Math.PI / 2 + 2 * Math.PI * (i + 0.5) / n;
    const out = [{ p: center, x: 50, y: 47, major: true }];
    seq.forEach((p, i) => {
      if (!p) return;
      const co = coIds.has(p.id);
      out.push({ p, x: 50 + 41 * Math.cos(ang(i)), y: 47 + 41 * Math.sin(ang(i)), major: co });
    });
    const badges = clusters.map(c => {
      const a = (ang(c.from) + ang(c.to)) / 2, empty = !c.place.length;
      const r = empty ? 30 : 24; // 단독 사건 뱃지는 사람 자리 쪽으로
      return { ...c, solo: !c.other && !c.ids.length, x: 50 + r * Math.cos(a), y: 47 + (r + 4) * Math.sin(a) };
    });
    return { out, coIds, badges };
  }

  function plan(S, list) {
    const home = S.agency === 'all' && !S.detailOpen && !S.query;
    const rootId = Model.agencyRoot(S.agency);
    const center = Model.get(S.selected);
    const activeCase = S.detailOpen ? center.records.find(r => r.id === S.caseId) : null;
    if (home) {
      const root = Model.get(Model.ROOT_ID);
      return { mode: 'ego', home, rootId, center: root, activeCase: null, ...caseLayout(S, list, root) };
    }
    if (S.detailOpen) return { mode: 'ego', home, rootId, center, activeCase, ...caseLayout(S, list, center) };
    const lay = Layout.forceLayout(list, rootId, S.agency);
    return { mode: 'force', home, rootId, center, activeCase: null, out: lay.positions, presetEdges: lay.edges, coIds: new Set(), badges: [] };
  }

  // ── 그리기 ──────────────────────────────────
  let layoutKey = '', prevSize = { w: 0, h: 0 };

  // 관계도 위 '○○ 중심' 표시 + 선택 해제 (인물을 골랐을 때만)
  function renderFocus(S, person) {
    const box = $('#mapFocus');
    if (!box) return;
    box.innerHTML = person ? `${avatar(person, 'ava--sm')}<span><b>${esc(person.name)}</b> 중심</span>
      <button class="map-focus__x" data-close-detail aria-label="${esc(person.name)} 선택 해제">선택 해제 ×</button>` : '';
  }
  function drawMap(S, list) {
    // 사건만 바뀐 경우: 배치·선은 그대로 두고 그 사건의 선만 돋보이게
    const gr = graph.getBoundingClientRect();
    const egoNow = S.detailOpen || (S.agency === 'all' && !S.query);
    const key = egoNow ? [S.detailOpen ? S.selected : Model.ROOT_ID, S.agency, S.query, Math.round(gr.width), Math.round(gr.height)].join('|') : '';
    if (key && key === layoutKey && last?.egoMode && $$('.node', nodeLayer).length) {
      last.activeCase = S.detailOpen ? last.center.records.find(r => r.id === S.caseId) || null : null;
      markActiveCase();
      return;
    }
    layoutKey = key;
    Relation.close(); hideMenu(true);
    nodeLayer.classList.remove('is-replay');
    const LW = nodeLayer.clientWidth || 1, LH = nodeLayer.clientHeight || 1;
    // 이전 그리기 때 크기 대비 비율: 크기가 바뀐 순간 기존 인물·선이 늘어나 보이지 않게 이전 픽셀 위치로 보정
    const sx = prevSize.w ? prevSize.w / LW : 1, sy = prevSize.h ? prevSize.h / LH : 1;
    const oldEls = [...nodeLayer.children];
    const before = new Map(oldEls.map(el => {
      const cs = getComputedStyle(el);
      return [el.dataset.id || el.dataset.intro, [parseFloat(cs.left) / LW * 100 * sx, parseFloat(cs.top) / LH * 100 * sy, +cs.opacity]];
    }));

    const { mode, out, home, rootId, center, activeCase, presetEdges, coIds, badges } = plan(S, list);
    const egoMode = mode === 'ego';

    const nodeKind = p => {
      if (!egoMode || p.id === center.id) return '';
      return coIds.has(p.id) ? 'is-co' : 'is-rel';
    };

    nodeLayer.innerHTML = out.map(({ p, x, y, major }) => `
      <button class="node ${p.id === center.id && S.detailOpen ? 'is-selected' : ''} ${p.id === rootId && (!egoMode || p.id === center.id) ? 'is-root' : ''} ${major ? 'is-major' : 'is-minor'} ${nodeKind(p)}"
        data-id="${esc(p.id)}" style="left:${x}%;top:${y}%" aria-label="${esc(p.name)} 재판 보기">
        ${avatar(p, 'node__dot')}<strong>${esc(p.name)}</strong>
      </button>`).join('');
    // 사건 뱃지: 누르면 그 사건의 재판 상세가 열림 (왼쪽 → 오른쪽). '그 밖의 관계'는 강조만
    groupLayer.innerHTML = badges.map((b, i) => b.other
      ? `<button class="group-tag group-tag--other" data-group="${i}" style="left:${b.x}%;top:${b.y}%" aria-label="그 밖의 관계 ${b.ids.length}명 강조">${esc(b.label)}<b>${b.ids.length}</b></button>`
      : `<button class="group-tag ${b.solo ? 'is-solo' : ''}" data-group="${i}" data-id="${esc(center.id)}" data-case-link="${esc(b.id)}" style="left:${b.x}%;top:${b.y}%"
          aria-label="${esc(center.name)} ${esc(b.label)} 사건 보기${b.solo ? ' (단독 재판)' : ` (함께 재판 ${b.ids.length}명)`}">${esc(b.label)}<b>${b.solo ? '단독' : b.ids.length}</b></button>`).join('');
    clearSpotlight();
    last = { center, activeCase, badges, coIds, egoMode };

    // 실제로 그려진 이름표 크기를 재서 겹침을 풀고, 선은 점의 가장자리에서 시작
    const g = graph.getBoundingClientRect();
    const dots = new Map();
    if (g.width && g.height) {
      const els = [...nodeLayer.children];
      const boxes = els.map((el, i) => {
        const ax = g.left + out[i].x * g.width / 100, ay = g.top + out[i].y * g.height / 100;
        const l = $('strong', el).getBoundingClientRect(), d = $('.node__dot', el).getBoundingClientRect();
        return { left: Math.min(l.left, d.left) - ax, right: Math.max(l.right, d.right) - ax,
          top: Math.min(l.top, d.top) - ay, bottom: Math.max(l.bottom, d.bottom) - ay,
          // 아바타만의 상자 (좁은 화면에서 이름표 둘 자리가 없을 때 대신 씀)
          dot: { left: d.left - ax, right: d.right - ax, top: d.top - ay, bottom: d.bottom - ay } };
      });
      Layout.resolveOverlaps(out, egoMode ? center.id : rootId, g.width, g.height, boxes);
      els.forEach((el, i) => {
        el.style.left = out[i].x + '%'; el.style.top = out[i].y + '%';
        el.classList.toggle('is-compact', !!out[i].compact);
        const d = $('.node__dot', el).getBoundingClientRect();
        dots.set(el.dataset.id, { x: out[i].x * g.width / 100, y: out[i].y * g.height / 100, r: d.width / 2 });
      });
      // 사건 뱃지: 인물·다른 뱃지와 겹치지 않는 가장 가까운 빈자리로 (관계도 안에서, 숨기지 않음)
      const taken = $$('.node .node__dot, .node strong', nodeLayer)
        .filter(el => getComputedStyle(el).display !== 'none').map(el => el.getBoundingClientRect());
      const hit = (r, list) => list.some(o => o.left < r.right + 2 && r.left < o.right + 2 && o.top < r.bottom + 2 && r.top < o.bottom + 2);
      const STEP = 6, MAX = Math.max(g.width, g.height);
      $$('.group-tag', groupLayer).forEach((tag, i) => {
        const b = badges[i], w = tag.offsetWidth, h = tag.offsetHeight;
        const cx0 = b.x * g.width / 100, cy0 = b.y * g.height / 100;
        const rectAt = (cx, cy) => ({ left: g.left + cx - w / 2, right: g.left + cx + w / 2, top: g.top + cy - h / 2, bottom: g.top + cy + h / 2 });
        const inside = (cx, cy) => cx - w / 2 >= 2 && cx + w / 2 <= g.width - 2 && cy - h / 2 >= 2 && cy + h / 2 <= g.height - 2;
        let best = null;
        // 목표 지점에서 동심원으로 넓혀 가며 첫 빈자리
        for (let r = 0; r <= MAX && !best; r += STEP) {
          const n = r ? Math.ceil(2 * Math.PI * r / STEP) : 1;
          for (let k = 0; k < n; k++) {
            const a = 2 * Math.PI * k / n, cx = cx0 + r * Math.cos(a), cy = cy0 + r * Math.sin(a);
            if (inside(cx, cy) && !hit(rectAt(cx, cy), taken)) { best = [cx, cy]; break; }
          }
        }
        const [cx, cy] = best || [Math.min(Math.max(cx0, w / 2), g.width - w / 2), Math.min(Math.max(cy0, h / 2), g.height - h / 2)];
        tag.style.left = cx / g.width * 100 + '%'; tag.style.top = cy / g.height * 100 + '%';
        taken.push(rectAt(cx, cy));
      });
    }

    // 선 목록: 중심 배치는 중심에서 각 인물로, 특검·검색 보기는 최소 연결만
    const pairs = egoMode
      ? out.filter(v => v.p.id !== center.id).map(v => [out[0], v])
      : presetEdges.slice();
    const isCo = ([a, b]) => egoMode ? coIds.has(b.p.id) : Model.triedTogether(a.p, b.p, S.agency);
    pairs.sort((m, n) => isCo(m) - isCo(n)); // 같은 재판 선을 위로

    const W = g.width || 900, H = g.height || 620;
    const at = v => dots.get(v.p.id) || { x: v.x * W / 100, y: v.y * H / 100, r: 14 };

    const oldEdges = [...edgeLayer.querySelectorAll(':scope > .edge')];
    edgeLayer.innerHTML = pairs.map(pair => {
      const [a, b] = pair, label = Model.linkLabel(a.p, b.p, S.agency) || '';
      const d = edgePath(at(a), at(b), W, H);
      const co = isCo(pair);
      return `<g class="edge ${co ? 'is-co' : 'is-rel'} ${egoMode ? 'is-active' : ''}" tabindex="0" role="button"
        aria-label="${esc(a.p.name + ' · ' + b.p.name + ' : ' + label)}" data-edge data-from="${esc(a.p.id)}" data-to="${esc(b.p.id)}">
        <path class="edge__hit" d="${d}"/><path class="edge__line" d="${d}"${co ? ' pathLength="1"' : ''}/><title>${esc(label)}</title></g>`;
    }).join('');

    // 안내 문구
    const caseN = badges.filter(b => !b.other).length, coN = coIds.size, otherN = out.length - 1 - coN;
    let ctx;
    if (egoMode) ctx = `${center.name} 중심 · 사건 ${caseN}건 · 함께 재판 ${coN}명${otherN ? ` · 그 밖의 관계 ${otherN}명` : ''} · 사건 뱃지를 누르면 그 사건이 열립니다`;
    else ctx = S.query ? `‘${S.query}’ 검색 결과`
      : `${S.agency} · 관련 인물 ${out.length}명`;
    $('#mapContext').textContent = ctx;

    fadeOut(oldEls, before, new Set(out.map(v => v.p.id)), oldEdges.length ? Math.round(RETRACT_MS * .75) : 0);
    // 기존 인물을 이전 픽셀 위치로 되돌려 둠 (크기 변화로 순간 이동하지 않게)
    if (sx !== 1 || sy !== 1) oldEls.forEach(el => { const b = before.get(el.dataset.id || el.dataset.intro); if (b) { el.style.left = b[0] + '%'; el.style.top = b[1] + '%'; } });
    lastSettle = animate(before, dots, W, H, egoMode ? `${center.id}|${S.agency}|${S.query}` : `${S.agency}|${S.query}`, oldEdges, [sx, sy]);
    prevSize = { w: LW, h: LH };
    renderFocus(S, egoMode && S.detailOpen ? center : null);
    // 지금 보는 사건 표시 + 같은 인물에서 사건만 바뀌었으면 그 사건 무리를 한 번 강조
    markActiveCase();
  }

  // 선 경로: 두 인물(px 좌표·아바타 반지름) 사이를 살짝 휜 곡선으로, 아바타 가장자리에서 시작 (viewBox 900×620)
  function edgePath(A, B, W, H) {
    const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    const ra = Math.min(A.r + 2, len / 3), rb = Math.min(B.r + 2, len / 3);
    const x1 = (A.x + ux * ra) * 900 / W, y1 = (A.y + uy * ra) * 620 / H;
    const x2 = (B.x - ux * rb) * 900 / W, y2 = (B.y - uy * rb) * 620 / H;
    const ex = x2 - x1, ey = y2 - y1, l = Math.hypot(ex, ey) || 1, bend = Math.min(24, l * 0.08);
    return `M ${x1} ${y1} Q ${(x1 + x2) / 2 - ey / l * bend} ${(y1 + y2) / 2 + ex / l * bend} ${x2} ${y2}`;
  }

  // ── 배치 전환 연출: 3단계 ─────────────────────
  //  ① 선 거두기: 기존 선이 모두 중심 쪽으로 빠르게 거둬짐 (실선은 끝에서부터 줄어들고, 점선은 흐려짐)
  //  ② 아바타 재배치: 선이 없는 상태에서 남는 인물은 새 자리로 이동, 새 인물은 제자리에서 등장
  //  ③ 선 다시 그리기: 인물이 자리 잡는 순간 같은 재판 실선부터 하나씩 그려지고, 점선이 뒤따름
  //  단계 사이는 앞 단계 끝무렵에 이어 붙여 멈추는 구간이 없게 함. 반환값: 전체 길이(ms)
  const RETRACT_MS = 240, MOVE_MS = 620, POP_MS = 380, DRAW_MS = 480, FADE_MS = 340;
  let lastSettle = 0, anim = 0, lastKey = '';
  const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeIn = t => t * t * t;
  const clamp01 = v => Math.min(1, Math.max(0, v));

  function animate(before, dots, W, H, key, oldEdges = [], [gsx, gsy] = [1, 1]) {
    measureBox(); // 움직이기 전, 최종 자리 기준으로 '전체가 보이는' 범위를 기록
    cancelAnimationFrame(anim);
    const changed = key !== lastKey;
    lastKey = key;
    $$('.edge-ghosts', edgeLayer).forEach(g => g.remove());
    const els = [...nodeLayer.children];
    const edges = $$('.edge', edgeLayer).map(g => ({
      g, line: $('.edge__line', g), co: g.classList.contains('is-co'),
    }));
    const finish = () => {
      $$('.edge-ghosts', edgeLayer).forEach(g => g.remove());
      edges.forEach(e => { e.line.style.strokeDasharray = ''; e.line.style.strokeDashoffset = ''; e.g.style.opacity = ''; });
      els.forEach(el => el.classList.remove('is-popping'));
    };
    if (reducedMotion()) { finish(); return 0; }

    // ── ② 인물: 이동 대상과 새로 등장할 인물 구분
    const nodes = els.map(el => {
      const id = el.dataset.id, to = [parseFloat(el.style.left), parseFloat(el.style.top)], from = before.get(id);
      if (from && from[2] > .98) return { el, id, from: [from[0], from[1]], to };
      return { el, id, from: to, to, pop: true, dist: Math.min(1, Math.hypot(to[0] - 50, to[1] - 47) / 45) };
    });
    const moved = nodes.some(n => !n.pop && (Math.abs(n.from[0] - n.to[0]) > .1 || Math.abs(n.from[1] - n.to[1]) > .1));
    const popped = nodes.some(n => n.pop);
    if (!moved && !popped && !changed) { finish(); return 0; }

    // ── ① 기존 선: 보관해 두었다가 거두기
    const ghosts = oldEdges.filter(g => {
      // 아직 그려지기 전(숨김)이던 선은 거둘 게 없으므로 제외 → 보이지 않던 선이 갑자기 나타났다 사라지지 않게
      const line = $('.edge__line', g);
      const shown = +(g.style.opacity || 1) * (1 - (parseFloat(line?.style.strokeDashoffset) || 0));
      return shown > .05;
    }).map(g => {
      g.removeAttribute('data-edge'); g.removeAttribute('tabindex'); g.removeAttribute('role');
      g.classList.remove('is-lit', 'is-spot', 'is-previewing');
      const line = $('.edge__line', g), dashable = line?.getAttribute('pathLength') === '1';
      if (dashable) { line.style.strokeDasharray = '1'; line.style.strokeDashoffset = '0'; }
      return { g, line, dashable };
    });
    if (ghosts.length) {
      const holder = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      holder.setAttribute('class', 'edge-ghosts');
      if (gsx !== 1 || gsy !== 1) holder.setAttribute('transform', `scale(${gsx} ${gsy})`); // 이전 크기 그대로 거둠
      ghosts.forEach(x => holder.appendChild(x.g));
      edgeLayer.prepend(holder);
    }

    // 단계 시작 시점
    const t2 = ghosts.length ? RETRACT_MS * .75 : 0;        // ② 재배치: 선 거두기 끝무렵부터
    nodes.forEach(n => {
      if (!n.pop) return;
      n.start = Math.round(t2 + n.dist * 240);              // 중심에서 가까운 순으로 등장
      n.el.style.setProperty('--d', n.start + 'ms');
      n.el.classList.add('is-popping');
    });
    const placeEnd = Math.max(moved ? t2 + MOVE_MS : 0, ...nodes.map(n => n.pop ? n.start + POP_MS : 0));
    const t3 = Math.max(t2, placeEnd - 90);                  // ③ 선 그리기: 인물이 자리 잡는 순간

    // ── ③ 새 선: 처음엔 모두 숨김
    let ci = 0, ri = 0;
    edges.forEach(e => {
      e.start = e.co ? t3 + Math.min(ci++, 16) * 30 : t3 + 160 + Math.min(ri++, 40) * 8;
      e.dur = e.co ? DRAW_MS : FADE_MS;
      if (e.co) { e.line.style.strokeDasharray = '1'; e.line.style.strokeDashoffset = '1'; }
      else e.g.style.opacity = '0';
    });
    const total = Math.max(placeEnd, ...edges.map(e => e.start + e.dur), ghosts.length ? RETRACT_MS : 0);

    const t0 = performance.now();
    let moving = moved;
    const frame = now => {
      const t = now - t0;
      // ①
      const r = clamp01(t / RETRACT_MS);
      ghosts.forEach(x => {
        if (x.dashable) x.line.style.strokeDashoffset = String(easeIn(r));
        x.g.style.opacity = String(x.dashable ? 1 - clamp01((r - .6) / .4) : 1 - easeOut(r));
      });
      if (r >= 1 && ghosts.length) { $$('.edge-ghosts', edgeLayer).forEach(g => g.remove()); ghosts.length = 0; }
      // ②
      if (moving) {
        const k = clamp01((t - t2) / MOVE_MS), q = easeInOut(k);
        nodes.forEach(n => {
          if (n.pop) return;
          n.el.style.left = n.from[0] + (n.to[0] - n.from[0]) * q + '%';
          n.el.style.top = n.from[1] + (n.to[1] - n.from[1]) * q + '%';
        });
        if (k >= 1) moving = false;
      }
      // ③
      edges.forEach(e => {
        const q = clamp01((t - e.start) / e.dur);
        if (e.co) e.line.style.strokeDashoffset = String(1 - easeOut(q));
        else e.g.style.opacity = String(easeOut(q));
      });
      if (t < total) anim = requestAnimationFrame(frame); else finish();
    };
    frame(t0);
    anim = requestAnimationFrame(frame);
    return total;
  }

  // 빠지는 인물: ① 선 거두기가 끝날 무렵(delay) 흐려지기 시작 → ② 재배치 단계에 속함
  function fadeOut(oldEls, before, keep, delay = 0) {
    if (reducedMotion()) return;
    const gone = oldEls.filter(el => el.dataset.id && !keep.has(el.dataset.id));
    if (!gone.length) return;
    let layer = $('#ghostLayer', graph);
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'ghostLayer'; layer.setAttribute('aria-hidden', 'true');
      graph.insertBefore(layer, nodeLayer);
    }
    layer.replaceChildren(...gone.map(el => {
      const [x, y] = before.get(el.dataset.id);
      el.style.left = x + '%'; el.style.top = y + '%';
      el.className = el.className.replace(/\bis-(popping|spot|hover|peer|peer-weak)\b/g, '') + ' is-leaving';
      el.removeAttribute('data-id'); el.tabIndex = -1;
      el.style.setProperty('--d', delay + 'ms');
      return el;
    }));
    clearTimeout(fadeOut.t);
    fadeOut.t = setTimeout(() => layer.replaceChildren(), 320 + delay);
  }

  // ── 오프닝 ──────────────────────────────────
  // 처음에는 두 핵심 인물만. 인물에 올리면(모바일은 누르면) 사건 목록이 펼쳐지고,
  // 사건을 고르면 그 인물에서 연결된 사람들이 거미줄처럼 뻗어 나감.
  const INTRO = [['yoon', 32, 50], ['keon', 68, 50]]; // 윤석열 · 김건희
  let introPlayed = false, menuTimer = 0;

  function drawIntro() {
    layoutKey = 'intro';
    prevSize = { w: nodeLayer.clientWidth, h: nodeLayer.clientHeight };
    $('#mapFocus') && ($('#mapFocus').hidden = true);
    clearSpotlight(); Relation.close(); last = null; lastKey = ''; cancelAnimationFrame(anim);
    const people = INTRO.map(([id, x, y]) => ({ p: Model.get(id), x, y })).filter(v => v.p);
    nodeLayer.innerHTML = people.map((v, i) => `
      <button class="node is-intro ${i === 0 ? 'is-root' : ''}" data-intro="${esc(v.p.id)}" style="left:${v.x}%;top:${v.y}%;--i:${i}"
        aria-haspopup="menu" aria-expanded="false" aria-label="${esc(v.p.name)} 사건 목록 보기">
        ${avatar(v.p, 'node__dot')}<strong>${esc(v.p.name)}</strong>
        <span class="intro-sub">${esc(v.p.role)} · 사건 ${v.p.records.length}건</span>
      </button>`).join('');
    nodeLayer.classList.toggle('is-replay', introPlayed);
    introPlayed = true;
    const touch = isMobile() || !canHover();
    groupLayer.innerHTML = `
      <p class="intro-hint">${touch ? '인물을 누르면' : '인물에 마우스를 올리면'} 사건 목록이 펼쳐집니다
        <button class="intro-skip" data-intro-skip>전체 관계도 보기</button></p>`;

    // 두 인물 사이 선 (아바타 가장자리에서 시작)
    const g = graph.getBoundingClientRect(), W = g.width || 900;
    const [a, b] = people;
    if (a && b) {
      const ra = $('.node__dot', nodeLayer.children[0]).offsetWidth / 2 + 10, rb = $('.node__dot', nodeLayer.children[1]).offsetWidth / 2 + 10;
      const x1 = (a.x / 100 * W + ra) * 900 / W, x2 = (b.x / 100 * W - rb) * 900 / W, y = a.y * 6.2;
      const label = Model.linkLabel(a.p, b.p, 'all') || '';
      edgeLayer.innerHTML = `<g class="edge is-rel is-active intro-edge" tabindex="0" role="button" data-edge data-from="${esc(a.p.id)}" data-to="${esc(b.p.id)}"
        aria-label="${esc(a.p.name + ' · ' + b.p.name + ' : ' + label)}"><path class="edge__hit" d="M ${x1} ${y} L ${x2} ${y}"/><path class="edge__line" d="M ${x1} ${y} L ${x2} ${y}"/><title>${esc(label)}</title></g>`;
    } else edgeLayer.innerHTML = '';

    $('#mapContext').textContent = '12·3 사건의 두 핵심 인물에서 시작합니다 · 사건을 고르면 연결된 사람들이 펼쳐집니다';
  }

  function showMenu(id) {
    clearTimeout(menuTimer);
    const node = $(`.node[data-intro="${id}"]`, nodeLayer);
    if (!node || $(`.case-menu[data-for="${id}"]`)) return;
    hideMenu(true);
    const p = Model.get(id), x = parseFloat(node.style.left), y = parseFloat(node.style.top);
    const gap = node.querySelector('.node__dot').offsetWidth / 2 + 20, right = x < 50;
    const menu = document.createElement('div');
    menu.className = `case-menu ${right ? 'is-right' : 'is-left'}`;
    menu.dataset.for = id;
    menu.setAttribute('role', 'menu');
    menu.style.top = y + '%';
    menu.style[right ? 'left' : 'right'] = `calc(${right ? x : 100 - x}% + ${gap}px)`;
    menu.innerHTML = `<p class="case-menu__head">${esc(p.name)}의 사건 <b>${p.records.length}</b></p>` + p.records.map((r, k) => `
      <button class="case-menu__item" role="menuitem" style="--k:${k}" data-id="${esc(p.id)}" data-case-link="${esc(r.id)}">
        <b>${esc(r.label)}</b><span>${esc(r.agency)} · ${esc(r.status)}</span>
      </button>`).join('');
    // 모바일은 아래 시트(position: fixed)라 확대·이동되는 관계도 바깥(body)에 둠
    (isMobile() ? document.body : groupLayer).appendChild(menu);
    node.setAttribute('aria-expanded', 'true');
    graph.classList.add('is-menu-open');
  }
  function hideMenu(now = false) {
    clearTimeout(menuTimer);
    const run = () => {
      $$('.case-menu').forEach(m => m.remove());
      $$('.node.is-intro', nodeLayer).forEach(n => n.setAttribute('aria-expanded', 'false'));
      graph.classList.remove('is-menu-open');
    };
    if (now) run(); else menuTimer = setTimeout(run, 280);
  }

  if (canHover()) {
    nodeLayer.addEventListener('mouseover', e => { const n = e.target.closest('.node.is-intro'); if (n) showMenu(n.dataset.intro); });
    groupLayer.addEventListener('mouseover', e => { if (e.target.closest('.case-menu')) clearTimeout(menuTimer); });
    graph.addEventListener('mouseout', e => {
      if (!$('.case-menu')) return;
      const to = e.relatedTarget;
      if (!to || !(to.closest?.('.case-menu') || to.closest?.('.node.is-intro'))) hideMenu();
    });
  }
  nodeLayer.addEventListener('click', e => {
    const n = e.target.closest('.node.is-intro');
    if (!n) return;
    if ($(`.case-menu[data-for="${n.dataset.intro}"]`) && !canHover()) hideMenu(true); else showMenu(n.dataset.intro);
  });
  // 메뉴 밖을 누르면 닫기 (터치 화면)
  document.addEventListener('click', e => {
    if ($('.case-menu') && !e.target.closest('.case-menu, .node.is-intro')) hideMenu(true);
  });
  // 키보드: 메뉴 안 첫 항목으로 이동, Esc로 닫기
  nodeLayer.addEventListener('keydown', e => {
    const n = e.target.closest('.node.is-intro');
    if (n && (e.key === 'ArrowDown' || e.key === 'ArrowRight')) { e.preventDefault(); showMenu(n.dataset.intro); $('.case-menu__item')?.focus(); }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !e.target.closest?.('.case-menu')) return;
    const id = e.target.closest('.case-menu').dataset.for;
    hideMenu(true); $(`.node[data-intro="${id}"]`, nodeLayer)?.focus();
  });

  // ── 사건 강조(스포트라이트) ─────────────────
  // 사건을 고르면 그 사건의 주요 인물이 한 번 떠올랐다가 원래대로 돌아옴
  let last = null, spotTimer = 0, spotStart = 0;
  function clearSpotlight() {
    clearTimeout(spotTimer); clearTimeout(spotStart);
    graph.classList.remove('is-spotlight');
    $$('.is-spot', graph).forEach(el => el.classList.remove('is-spot'));
  }

  function spotlight(ids, delay = 0) {
    clearSpotlight();
    if (!ids?.size || !last) return;
    spotStart = setTimeout(() => {
      graph.classList.add('is-spotlight');
      let k = 0;
      $$('.node', nodeLayer).forEach(n => {
        if (!ids.has(n.dataset.id)) return;
        n.style.setProperty('--i', k++);
        n.classList.add('is-spot');
      });
      $$('.edge', edgeLayer).forEach(e => { if (ids.has(e.dataset.from) && ids.has(e.dataset.to)) e.classList.add('is-spot'); });
      spotTimer = setTimeout(clearSpotlight, reducedMotion() ? 1200 : 1600 + k * 70);
    }, reducedMotion() ? 0 : delay);
  }

  // 지금 상세에서 보는 사건의 뱃지를 표시
  function markActiveCase() {
    const active = last?.egoMode && last.activeCase ? last.badges.find(b => b.id === last.activeCase.id) : null;
    $$('.group-tag', groupLayer).forEach((t, i) => t.classList.toggle('is-active', !!active && last.badges[i] === active));
    const ids = new Set(active?.ids || []);
    graph.classList.toggle('has-case', !!active && ids.size > 0); // 단독 사건이면 선 강조 없음
    $$('.edge', edgeLayer).forEach(e => e.classList.toggle('is-case', ids.has(e.dataset.to) || ids.has(e.dataset.from) && e.dataset.from !== last.center.id));
  }
  // 그 사건 무리(+중심 인물)를 한 번 강조
  function spotlightCase() {
    if (!last?.egoMode || !last.activeCase) return;
    const b = last.badges.find(v => v.id === last.activeCase.id);
    spotlight(new Set([...(b?.ids || []), last.center.id]), Math.max(0, lastSettle - 120));
  }

  // '그 밖의 관계' 뱃지: 상세를 바꾸지 않고 그 무리만 강조
  groupLayer.addEventListener('click', e => {
    const t = e.target.closest('.group-tag--other');
    const b = t && last?.badges[+t.dataset.group];
    if (b) spotlight(new Set([...b.ids, last.center.id]));
  });

  // ── 마우스 오버 강조 ─────────────────────────
  function bindHover() {
    if (!canHover()) return;
    let current = null;
    const clear = () => {
      $$('.is-hover, .is-peer, .is-peer-weak', graph).forEach(el => el.classList.remove('is-hover', 'is-peer', 'is-peer-weak'));
      $$('.edge.is-lit', graph).forEach(el => el.classList.remove('is-lit'));
      graph.classList.remove('is-pointing'); current = null;
    };
    const light = id => {
      if (id === current) return;
      clear(); current = id; graph.classList.add('is-pointing');
      const strong = new Set(), weak = new Set();
      $$('.edge', edgeLayer).forEach(e => {
        const { from, to } = e.dataset;
        if (from !== id && to !== id) return;
        e.classList.add('is-lit');
        (e.classList.contains('is-co') ? strong : weak).add(from === id ? to : from);
      });
      $$('.node', nodeLayer).forEach(n => {
        if (n.dataset.id === id) n.classList.add('is-hover');
        else if (strong.has(n.dataset.id)) n.classList.add('is-peer');
        else if (weak.has(n.dataset.id)) n.classList.add('is-peer-weak');
      });
    };
    graph.addEventListener('mouseenter', () => graph.classList.add('is-hovering'));
    graph.addEventListener('mouseleave', () => { graph.classList.remove('is-hovering'); clear(); });
    graph.addEventListener('mouseover', e => {
      const node = e.target.closest('.node');
      if (node?.dataset.intro) return; // 오프닝 인물은 메뉴로 처리
      if (node) return light(node.dataset.id);
      const edge = e.target.closest('.edge');
      if (edge) {
        clear(); edge.classList.add('is-lit'); graph.classList.add('is-pointing');
        $$('.node', nodeLayer).forEach(n => { if (n.dataset.id === edge.dataset.from || n.dataset.id === edge.dataset.to) n.classList.add('is-peer'); });
        return;
      }
      if (current) clear();
    });
  }
  bindHover();

  // ── 관계도 이동·확대 (데스크톱·모바일 공통) ─────────────────
  // 모바일: 관계도를 넉넉한 크기(680×620)로 그리고 한 손가락 끌기 = 이동, 두 손가락 = 확대·축소. 기본 0.9배
  // 데스크톱: 영역에 꼭 맞게 그린 1배가 기본, + − 버튼과 마우스 끌기로 이동·확대
  // 어느 쪽이든 페이지 스크롤은 없음(관계도 영역 안에서만 움직임). view.x·y = 관계도 왼쪽 위의 영역 안 좌표
  const pane = $('#mapPane');
  const view = { s: 1, x: 0, y: 0 }, DEFAULT_S = .9, MAX_S = 2.5;
  let viewKey = null, viewMode = null, moved = false; // moved: 사용자가 끌거나 확대했는지 (데스크톱 기본 보기 유지 판단)
  const fitS = () => Math.min(pane.clientWidth / graph.offsetWidth, pane.clientHeight / graph.offsetHeight);
  const minS = () => isMobile() ? Math.min(fitS() * .9, DEFAULT_S) : .5;
  function applyView() {
    const tx = view.x - graph.offsetLeft, ty = view.y - graph.offsetTop; // 변형 전 자리 기준
    graph.style.transform = (view.s === 1 && !tx && !ty) ? '' : `translate(${tx}px, ${ty}px) scale(${view.s})`;
  }
  function clampView() {
    const W = graph.offsetWidth * view.s, H = graph.offsetHeight * view.s, pw = pane.clientWidth, ph = pane.clientHeight, m = 80;
    view.x = Math.min(pw - m, Math.max(m - W, view.x));
    view.y = Math.min(ph - m, Math.max(m - H, view.y));
  }
  function zoomAt(s, cx, cy) {
    s = Math.min(MAX_S, Math.max(minS(), s));
    const k = s / view.s;
    view.x = cx - (cx - view.x) * k; view.y = cy - (cy - view.y) * k; view.s = s; moved = true;
    clampView(); applyView();
  }
  // 기본 보기: 중심 인물(관계도 50%, 47%)을 영역 가운데로
  // 인물·사건 뱃지의 최종 자리(%)로 만든 범위. 데스크톱 기본 보기는 이 범위가 영역 안에 다 들어오게 맞춤
  let box = null;
  function measureBox() {
    const els = [...nodeLayer.children, ...groupLayer.children].filter(el => el.style.left && el.style.top);
    if (!els.length) { box = null; return; }
    const xs = els.map(el => parseFloat(el.style.left)), ys = els.map(el => parseFloat(el.style.top));
    box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }
  function fitDesktop() {
    view.s = 1; view.x = graph.offsetLeft; view.y = graph.offsetTop;
    if (!box) return;
    const gw = graph.offsetWidth, gh = graph.offsetHeight;
    const PAD = { l: 48, r: 72, t: 40, b: 60 }; // 인물 원·이름표 크기 + 오른쪽 확대 버튼 자리
    const bx0 = box.x0 / 100 * gw - PAD.l, bx1 = box.x1 / 100 * gw + PAD.r, by0 = box.y0 / 100 * gh - PAD.t, by1 = box.y1 / 100 * gh + PAD.b;
    const vw = pane.clientWidth, vh = pane.clientHeight - graph.offsetTop; // 관계도에 쓸 수 있는 영역
    const bw = bx1 - bx0, bh = by1 - by0;
    if (bx0 >= 0 && by0 >= 0 && bx1 <= vw - graph.offsetLeft && by1 <= vh) return; // 이미 다 보임
    view.s = Math.max(.5, Math.min(1, vw / bw, vh / bh));
    view.x = (vw - bw * view.s) / 2 - bx0 * view.s;
    view.y = graph.offsetTop + (vh - bh * view.s) / 2 - by0 * view.s;
  }
  function resetView(fit = false) {
    moved = false;
    if (!isMobile()) { fitDesktop(); applyView(); return; }
    view.s = fit ? Math.min(fitS(), 1) : Math.max(DEFAULT_S, fitS());
    view.x = pane.clientWidth / 2 - graph.offsetWidth * .5 * view.s;
    view.y = pane.clientHeight / 2 - graph.offsetHeight * .47 * view.s;
    if (!fit) clampView();
    applyView();
  }
  // 보기 규칙: 시작 화면은 기본 보기, 시작 화면(또는 첫 진입)에서 관계도로 넘어오면 '전체'.
  // 그 뒤로는 인물을 고르거나 풀어도 사용자가 맞춰 둔 확대·위치를 그대로 유지 (중심 인물은 항상 같은 자리)
  function centerOnMobile() {
    const mode = isMobile() ? 'm' : 'd';
    if (mode !== viewMode) { viewMode = mode; viewKey = null; } // 화면 폭이 모바일↔데스크톱으로 바뀌면 처음부터
    const prev = viewKey;
    viewKey = layoutKey;
    if (layoutKey === 'intro') { if (prev !== 'intro') resetView(); else applyView(); return; }
    if (prev === null || prev === 'intro') { resetView(true); return; }
    // 데스크톱에서 직접 옮기지 않았다면 기본 보기 그대로 ('○○ 중심' 줄이 생기거나 사라져 관계도 자리가 바뀌어도 어긋나지 않게)
    if (!isMobile() && !moved) { resetView(); return; }
    clampView(); applyView();
  }

  // 손가락 조작: 끌기 = 이동, 두 손가락 = 확대·축소. 끌었으면 그 뒤 탭(클릭)은 무시
  const pts = new Map();
  let gesture = null, dragged = false;
  const local = e => { const r = pane.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const startGesture = () => {
    const ps = [...pts.values()];
    if (ps.length === 1) gesture = { type: 'pan', p0: ps[0], vx: view.x, vy: view.y };
    else if (ps.length >= 2) {
      const [a, b] = ps;
      gesture = { type: 'pinch', d0: Math.hypot(b.x - a.x, b.y - a.y) || 1, m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, s0: view.s, vx: view.x, vy: view.y };
    } else gesture = null;
  };
  pane.addEventListener('pointerdown', e => {
    if (!pts.size) dragged = false; // 새 손가락 조작마다 '끌었음' 초기화 (버튼 탭이 막히지 않게)
    if (e.target.closest('.map-zoom, .map-focus, .case-menu')) return;
    if (e.pointerType === 'mouse') { if (e.button !== 0) return; e.preventDefault(); } // 마우스 끌기 중 글자 선택 방지
    pts.set(e.pointerId, local(e));
    startGesture();
  });
  addEventListener('pointermove', e => {
    if (!gesture || !pts.has(e.pointerId)) return;
    pts.set(e.pointerId, local(e));
    const ps = [...pts.values()];
    if (gesture.type === 'pan' && ps.length === 1) {
      const dx = ps[0].x - gesture.p0.x, dy = ps[0].y - gesture.p0.y;
      if (Math.hypot(dx, dy) > 6) dragged = true;
      if (!dragged) return;
      view.x = gesture.vx + dx; view.y = gesture.vy + dy; moved = true;
      clampView(); applyView();
    } else if (gesture.type === 'pinch' && ps.length >= 2) {
      dragged = true;
      const [a, b] = ps, d = Math.hypot(b.x - a.x, b.y - a.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const s = Math.min(MAX_S, Math.max(minS(), gesture.s0 * d / gesture.d0)), k = s / gesture.s0;
      view.s = s;
      view.x = m.x - (gesture.m0.x - gesture.vx) * k;
      view.y = m.y - (gesture.m0.y - gesture.vy) * k;
      clampView(); applyView();
    }
  }, { passive: true });
  const endPointer = e => { if (!pts.delete(e.pointerId)) return; startGesture(); };
  addEventListener('pointerup', endPointer);
  addEventListener('pointercancel', endPointer);
  pane.addEventListener('click', e => { if (dragged && !e.target.closest('.map-zoom, .map-focus')) { e.stopPropagation(); e.preventDefault(); dragged = false; } }, true);

  // + − 전체 버튼
  $('#mapZoom')?.addEventListener('click', e => {
    const b = e.target.closest('[data-zoom]');
    if (!b) return;
    const c = { x: pane.clientWidth / 2, y: pane.clientHeight / 2 };
    if (b.dataset.zoom === 'in') zoomAt(view.s * 1.4, c.x, c.y);
    else if (b.dataset.zoom === 'out') zoomAt(view.s / 1.4, c.x, c.y);
    else resetView(true);
  });

  // 그리기·측정은 변형 없이(실제 크기로) 하고, 끝나면 보기를 되돌림
  const unscaled = fn => (...a) => {
    const t = graph.style.transform;
    graph.style.transform = '';
    try { return fn(...a); } finally { graph.style.transform = t; }
  };
  const render = unscaled(drawMap), renderIntro = unscaled(drawIntro);

  // 사건 강조 해제 (다시 그리지 않음)
  function clearCase() {
    if (!last) return;
    last.activeCase = null;
    markActiveCase();
  }

  return { render, renderIntro, centerOnMobile, spotlightCase, clearCase };
})();
