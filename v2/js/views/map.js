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
  function caseLayout(S, list, center, mergeSolos = true) {
    const inList = new Set(list.map(p => p.id));
    const recs = center.records.filter(r => S.agency === 'all' || r.agency === S.agency);
    const cases = recs.map(r => ({
      id: r.id, label: shortLabel(r.label), agency: r.agency,
      ids: [...Model.trialmates(center, r)].filter(id => inList.has(id)), // 화면에 놓을 사람(검색·필터 반영)
      total: Model.trialmates(center, r).size, // 실제 공동피고인 수(사건 기록 기준)
      sep: Model.separateTrial(center, r).filter(id => inList.has(id)), // 같은 사건 · 별도 재판 (점선으로 그 사건 곁에)
    }));
    const coIds = new Set(cases.flatMap(c => c.ids));
    const placed = new Set(), clusters = [];
    [...cases].sort((a, b) => (b.ids.length + b.sep.length) - (a.ids.length + a.sep.length)).forEach(c => {
      const own = [...c.ids, ...c.sep.filter(id => !coIds.has(id))].filter(id => !placed.has(id));
      own.forEach(id => placed.add(id));
      clusters.push({ ...c, place: own.map(id => Model.get(id)) });
    });
    const others = list.filter(p => p.id !== center.id && !coIds.has(p.id) && !placed.has(p.id) && Model.linkLabel(center, p, S.agency));
    if (others.length) clusters.push({ id: '', label: '그 밖의 관계', other: true, ids: others.map(p => p.id), place: others });
    // 단독 재판 사건(함께 재판받는 사람 없음)이 둘 이상이면 뱃지 하나로 묶어 가운데를 덜 복잡하게 → 누르면 목록이 펼쳐짐
    const solos = clusters.filter(c => !c.total && !c.place.length && !c.other);
    if (mergeSolos && solos.length >= 2) {
      const at = clusters.indexOf(solos[0]);
      solos.forEach(c => clusters.splice(clusters.indexOf(c), 1));
      clusters.splice(Math.min(at, clusters.length), 0, { id: '', label: '단독 재판', soloGroup: true, members: solos.map(c => ({ id: c.id, label: c.label, agency: c.agency })), ids: [], place: [] });
    }

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
      const r = empty ? 19 : 24; // 단독 사건 뱃지는 중심 인물 가까이(가는 점선으로 이어 줌)
      return { ...c, solo: !c.other && !c.soloGroup && !c.total, x: 50 + r * Math.cos(a), y: 47 + (r + 4) * Math.sin(a) };
    });
    return { out, coIds, badges };
  }

  // branch: 좌우 가지형(넓은 화면)은 단독 재판을 한 상자에 따로 모으므로 묶지 않은 사건 목록을 씀
  function plan(S, list, branch = false) {
    const home = S.agency === 'all' && !S.detailOpen && !S.query;
    const rootId = Model.agencyRoot(S.agency);
    const center = Model.get(S.selected);
    const activeCase = S.detailOpen ? center.records.find(r => r.id === S.caseId) : null;
    if (home) {
      const root = Model.get(Model.ROOT_ID);
      return { mode: 'ego', home, rootId, center: root, activeCase: null, ...caseLayout(S, list, root, !branch) };
    }
    if (S.detailOpen) return { mode: 'ego', home, rootId, center, activeCase, ...caseLayout(S, list, center, !branch) };
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
    // 넓은 화면의 인물 중심 보기는 좌우 가지형(가운데 인물, 양옆 사건 상자)으로
    if (egoNow && useBranch(gr.width)) return drawBranch(S, list);
    const LW = nodeLayer.clientWidth || 1, LH = nodeLayer.clientHeight || 1;
    // 이전 그리기 때 크기 대비 비율: 크기가 바뀐 순간 기존 인물·선이 늘어나 보이지 않게 이전 픽셀 위치로 보정
    const sx = prevSize.w ? prevSize.w / LW : 1, sy = prevSize.h ? prevSize.h / LH : 1;
    // 좌우 가지형에서 넘어오면: 상자 속 사진 자리(관계도 안 백분율)에서 출발
    const wasBranch = !!$('.bx-wrap', nodeLayer);
    const oldEls = wasBranch ? $$('.node[data-id]', nodeLayer) : [...nodeLayer.children];
    const before = new Map(oldEls.map(el => {
      if (wasBranch) {
        const d = $('.node__dot', el).getBoundingClientRect();
        return [el.dataset.id, [(d.left + d.width / 2 - gr.left) / (gr.width || 1) * 100, (d.top + d.height / 2 - gr.top) / (gr.height || 1) * 100, 1]];
      }
      const cs = getComputedStyle(el);
      return [el.dataset.id || el.dataset.intro, [parseFloat(cs.left) / LW * 100 * sx, parseFloat(cs.top) / LH * 100 * sy, +cs.opacity]];
    }));
    leaveBranch();

    const { mode, out, home, rootId, center, activeCase, presetEdges, coIds, badges } = plan(S, list);
    const egoMode = mode === 'ego';

    const nodeKind = p => {
      if (!egoMode || p.id === center.id) return '';
      return coIds.has(p.id) ? 'is-co' : 'is-rel';
    };

    // 관계도 영역이 작은데 사람이 많으면(15인치 노트북 등) 사진·이름표를 한 단계 작게
    graph.classList.toggle('is-dense', egoMode && !isMobile() && out.length > 20 && gr.width * gr.height < out.length * 15000);
    nodeLayer.innerHTML = out.map(({ p, x, y, major }) => `
      <button class="node ${p.id === center.id && S.detailOpen ? 'is-selected' : ''} ${p.id === rootId && (!egoMode || p.id === center.id) ? 'is-root' : ''} ${major ? 'is-major' : 'is-minor'} ${nodeKind(p)}"
        data-id="${esc(p.id)}" style="left:${x}%;top:${y}%" aria-label="${esc(p.name)} 재판 보기">
        ${avatar(p, 'node__dot')}<strong>${esc(p.name)}</strong>
      </button>`).join('');
    // 사건 뱃지: 누르면 그 사건의 재판 상세가 열림 (왼쪽 → 오른쪽). '그 밖의 관계'는 강조만
    groupLayer.innerHTML = badges.map((b, i) => b.soloGroup
      ? `<button class="group-tag is-solo group-tag--solos" data-group="${i}" data-solo-group aria-expanded="false" aria-controls="soloMenu" style="left:${b.x}%;top:${b.y}%"
          aria-label="${esc(center.name)} 단독 재판 ${b.members.length}건 목록 열기">${esc(b.label)}<b>${b.members.length}</b></button>`
      : b.other
      ? `<button class="group-tag group-tag--other" data-group="${i}" style="left:${b.x}%;top:${b.y}%" aria-label="그 밖의 관계 ${b.ids.length}명 강조">${esc(b.label)}<b>${b.ids.length}</b></button>`
      : `<button class="group-tag ${b.solo ? 'is-solo' : ''}" data-group="${i}" data-id="${esc(center.id)}" data-case-link="${esc(b.id)}" style="left:${b.x}%;top:${b.y}%"
          aria-label="${esc(center.name)} ${esc(b.label)} 사건 보기${b.solo ? ' (단독 재판)' : ` (함께 재판 ${b.total}명)`}">${esc(b.label)}<b>${b.solo ? '단독' : b.total}</b></button>`).join('');
    const sg = badges.find(b => b.soloGroup);
    if (sg) groupLayer.insertAdjacentHTML('beforeend', `<div class="solo-menu" id="soloMenu" role="menu" hidden>
      <p class="solo-menu__title">${esc(center.name)} 혼자 피고인인 재판</p>
      ${sg.members.map(m => `<button class="solo-menu__item" role="menuitem" data-id="${esc(center.id)}" data-case-link="${esc(m.id)}">${esc(m.label)}<small>${esc(m.agency)}</small></button>`).join('')}</div>`);
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
        b.px = { x: cx, y: cy, w, h }; // 단독 사건 점선 끝점
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
    // 단독 사건 뱃지: 함께 재판받는 사람이 없어 선이 없으므로, 중심 인물에서 뱃지까지 가는 점선으로 '이 사람의 사건'임을 보여 줌
    if (egoMode) edgeLayer.insertAdjacentHTML('afterbegin', badges.filter(b => (b.solo || b.soloGroup) && b.px).map(b => {
      const A = at(out[0]), dx = b.px.x - A.x, dy = b.px.y - A.y, len = Math.hypot(dx, dy) || 1;
      // 뱃지 쪽 끝은 뱃지 테두리에서 멈춤(가로·세로 중 먼저 닿는 쪽)
      const stop = Math.min(Math.abs(b.px.w / 2 / (dx / len || 1e-6)), Math.abs(b.px.h / 2 / (dy / len || 1e-6))) + 3;
      if (len - stop <= A.r + 6) return '';
      const x1 = (A.x + dx / len * (A.r + 3)) * 900 / W, y1 = (A.y + dy / len * (A.r + 3)) * 620 / H;
      const x2 = (b.px.x - dx / len * stop) * 900 / W, y2 = (b.px.y - dy / len * stop) * 620 / H;
      return `<path class="solo-stem" data-case="${esc(b.soloGroup ? b.members.map(m => m.id).join(' ') : b.id)}" d="M ${x1} ${y1} L ${x2} ${y2}"/>`;
    }).join(''));

    // 안내 문구
    const caseN = badges.reduce((n, b) => n + (b.other ? 0 : b.soloGroup ? b.members.length : 1), 0);
    let ctx;
    if (egoMode) ctx = `${center.name} 중심 · 사건 ${caseN}건 · 사건 뱃지를 누르면 그 사건이 열립니다`;
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

  // ── 좌우 가지형: 넓은 화면의 인물 중심 보기 ─────────────
  // 가운데 중심 인물, 양옆 기둥에 사건 상자(양쪽 높이가 비슷하게 나눔). 중심 인물에서 상자마다 곡선 하나.
  //  · 상자 제목을 누르면 그 재판 상세 · 상자 안 사람을 누르면 그 사람 중심으로(같은 사건 기록이 열림)
  //  · 여러 사건에 걸친 사람은 그 사건 상자마다 나옴(가운데 인물 아래 '연결 N명'은 한 번만 셈)
  //  · 단독 재판은 한 상자에 모으고, 사건이 아닌 관계는 '그 밖의 관계' 상자
  //  · 영역에 다 들어가지 않으면 한 단계씩 작게(사진 40 → 32 → 가로 이름표 → 촘촘한 이름표), 그래도 넘치면 기둥 안에서만 세로 스크롤
  // 모바일(그래프 보기)과 특검·검색 보기는 기존 배치 그대로
  const BRANCH_MIN_W = 520;
  const useBranch = w => !isMobile() && w >= BRANCH_MIN_W;
  const LEGEND_NOTE = $('.legend__note')?.textContent || '';
  const BRANCH_NOTE = '상자는 같은 사건·기소 내용 또는 가족 관계로 묶은 것이며 공모나 유죄를 뜻하지 않습니다. 사건 제목을 누르면 재판 상세, 사람을 누르면 그 사람 중심으로 바뀝니다.';
  function setNote(t) { const n = $('.legend__note'); if (n && n.textContent !== t) n.textContent = t; }
  function leaveBranch() {
    graph.classList.remove('is-branch', 'is-bx-pointing'); $('#mapPane').classList.remove('is-branch');
    setNote(LEGEND_NOTE);
  }
  function ghostLayer() {
    let layer = $('#ghostLayer', graph);
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'ghostLayer'; layer.setAttribute('aria-hidden', 'true');
      graph.insertBefore(layer, nodeLayer);
    }
    return layer;
  }

  function drawBranch(S, list) {
    const { center, activeCase, coIds, badges } = plan(S, list, true);
    cancelAnimationFrame(anim); clearSpotlight(); closeSoloMenu();
    const g = graph.getBoundingClientRect();
    // 이전 사진 자리(가운데·크기): 남는 사람은 그 자리에서 새 자리로 날아감
    const prev = new Map();
    $$('.node[data-id], .node[data-intro]', nodeLayer).forEach(el => { const id = el.dataset.id || el.dataset.intro; if (!prev.has(id)) prev.set(id, $('.node__dot', el).getBoundingClientRect()); });
    const key = `b|${center.id}|${S.agency}|${S.query}`, changed = key !== lastKey;
    lastKey = key;
    // 처음 화면(clock.html) 전환이 움직임을 맡을 때(MAP_SKIP_ANIM)·움직임 줄이기·크기만 바뀐 경우는 바로 결과 배치
    const skip = window.MAP_SKIP_ANIM; window.MAP_SKIP_ANIM = false;
    const motion = changed && !skip && !reducedMotion();
    const oldWrap = $('.bx-wrap', nodeLayer), oldNodes = oldWrap ? [] : $$('.node[data-id]', nodeLayer);
    const oldEdges = [...edgeLayer.children];

    const recOf = id => center.records.find(r => r.id === id);
    // 그 사람의 같은 사건 기록 (같은 재판 → 같은 사건 별도 재판 순)
    const recFor = (p, r) => r && (Model.sameTrialRec(center, r, p) || p.records.find(o => (o.related || []).includes(center.id)));
    const chip = (p, kind, r, title = '') => {
      const o = recFor(p, r);
      return `<button class="node bx-chip ${kind}" data-id="${esc(p.id)}"${o ? ` data-case-link="${esc(o.id)}"` : ''}${title ? ` title="${esc(title)}"` : ''}
        aria-label="${esc(p.name)} 중심으로 보기">${avatar(p, 'node__dot')}<strong>${esc(p.name)}</strong></button>`;
    };
    const items = [], solos = [];
    badges.forEach((b, i) => {
      if (b.other) return;
      // 그 사건의 사람 모두(함께 재판 → 같은 사건 별도 재판 순). 여러 사건에 걸친 사람은 사건 상자마다 나옴
      const ids = [...new Set([...b.ids, ...(b.sep || [])])].filter(id => id !== center.id);
      if (!b.total && !ids.length) { solos.push([b, i]); return; }
      const r = recOf(b.id);
      const count = b.total ? `함께 ${b.total}명` : '별도 재판';
      items.push(`<section class="bx${b.total ? '' : ' is-sep'}" data-b="${i}">
        <i class="bx-bg" aria-hidden="true"></i>
        <button class="group-tag bx-head" data-group="${i}" data-id="${esc(center.id)}" data-case-link="${esc(b.id)}"
          aria-label="${esc(center.name)} ${esc(b.label)} 재판 보기 (${count})"><span class="bx-head__t">${esc(b.label)}</span><small>${esc(b.agency)}</small><b>${count}</b></button>
        ${ids.length ? `<div class="bx-ppl">${ids.map(id => chip(Model.get(id), b.ids.includes(id) ? 'is-co' : 'is-rel is-sep', r)).join('')}</div>`
          : `<p class="bx-also">함께 재판받는 ${b.total}명은 지금 조건(검색·특검)에서 숨겨져 있습니다</p>`}
      </section>`);
    });
    if (solos.length) items.push(`<section class="bx is-solo" data-b="solo">
        <i class="bx-bg" aria-hidden="true"></i>
        <p class="bx-head bx-head--static"><span class="bx-head__t">단독 재판</span><b>${solos.length}건</b></p>
        <div class="bx-solos">${solos.map(([b, i]) => `<button class="group-tag is-solo bx-solo" data-group="${i}" data-id="${esc(center.id)}" data-case-link="${esc(b.id)}"
          aria-label="${esc(center.name)} ${esc(b.label)} 재판 보기 (단독 재판)">${esc(b.label)}</button>`).join('')}</div>
      </section>`);
    const oi = badges.findIndex(b => b.other);
    if (oi >= 0) items.push(`<section class="bx is-other" data-b="${oi}">
        <i class="bx-bg" aria-hidden="true"></i>
        <button class="group-tag group-tag--other bx-head" data-group="${oi}" aria-label="그 밖의 관계 ${badges[oi].ids.length}명 강조"><span class="bx-head__t">그 밖의 관계</span><small>같은 재판 아님</small><b>${badges[oi].ids.length}명</b></button>
        <div class="bx-ppl">${badges[oi].place.map(p => chip(p, 'is-rel', null, Model.linkLabel(center, p, S.agency) || '')).join('')}</div>
      </section>`);

    const caseN = center.records.filter(r => S.agency === 'all' || r.agency === S.agency).length;
    const placedIds = badges.filter(b => !b.other).flatMap(b => b.place.map(p => p.id));
    const otherN = oi >= 0 ? badges[oi].ids.length : 0;
    // 가운데 인물: '○○ 중심' 줄 대신 사진 아래에 선택 해제 (관계도 높이를 아낌)
    const hub = `<div class="bx-center"><button class="node bx-hub ${S.detailOpen ? 'is-selected' : ''} ${center.id === Model.agencyRoot(S.agency) ? 'is-root' : ''}" data-id="${esc(center.id)}"
        aria-label="${esc(center.name)} ${S.detailOpen ? '선택 해제' : '재판 보기'}">${avatar(center, 'node__dot')}<strong>${esc(center.name)}</strong>
        ${center.role ? `<small class="bx-hub__role">${esc(center.role)}</small>` : ''}<small>사건 ${caseN}건 · 연결 ${placedIds.length + otherN}명</small></button>
        ${S.detailOpen ? `<button class="bx-center__x" data-close-detail aria-label="${esc(center.name)} 선택 해제">선택 해제 ×</button>` : ''}</div>`;

    // 그리기: 상자 높이를 재서 양쪽 기둥 높이가 비슷하게 나누고, 넘치면 한 단계 작게
    graph.classList.add('is-branch'); $('#mapPane').classList.add('is-branch');
    graph.classList.remove('is-dense', 'is-spotlight', 'has-case', 'has-solo', 'is-bx-pointing');
    setNote(BRANCH_NOTE);
    groupLayer.innerHTML = '';
    nodeLayer.innerHTML = `<div class="bx-wrap${items.length === 1 ? ' is-single' : ''}${items.length ? '' : ' is-alone'}">
      <svg class="bx-links" aria-hidden="true"></svg><div class="bx-side is-l"></div>${hub}<div class="bx-side is-r"></div></div>`;
    const wrap = $('.bx-wrap', nodeLayer), L = $('.bx-side.is-l', wrap), R = $('.bx-side.is-r', wrap);
    const tpl = document.createElement('template');
    tpl.innerHTML = items.join('');
    const els = [...tpl.content.children];
    const fits = side => side.scrollHeight <= side.clientHeight + 1;
    for (let fit = 0; fit <= 4; fit++) {
      wrap.dataset.fit = fit;
      if (els.length === 1) R.append(els[0]);
      else if (els.length) {
        els.forEach(el => L.append(el)); // 두 기둥 폭이 같으므로 한쪽에 모아 높이를 잼
        const hs = els.map(el => el.offsetHeight);
        let hl = 0, hr = 0;
        els.forEach((el, k) => { if (hl <= hr) { L.append(el); hl += hs[k]; } else { R.append(el); hr += hs[k]; } });
      }
      if (fit === 4 || (fits(L) && fits(R))) break;
    }

    // 곡선: 중심 인물 사진 가장자리 → 상자 안쪽 가장자리(제목 높이). 기둥이 스크롤되면 보이는 범위 안으로
    function links() {
      const svg = $('.bx-links', wrap), w = wrap.getBoundingClientRect(), h = $('.bx-hub .node__dot', wrap).getBoundingClientRect();
      svg.setAttribute('viewBox', `0 0 ${w.width} ${w.height}`);
      const hx = h.left + h.width / 2 - w.left, hy = h.top + h.height / 2 - w.top, hr = h.width / 2 + 6;
      svg.innerHTML = $$('.bx', wrap).map(bx => {
        const r = bx.getBoundingClientRect(), s = bx.parentElement.getBoundingClientRect(), head = $('.bx-head', bx).getBoundingClientRect();
        if (r.bottom < s.top + 8 || r.top > s.bottom - 8) return '';
        const left = r.left + r.width / 2 < h.left + h.width / 2;
        const x = (left ? r.right : r.left) - w.left;
        const y = Math.min(Math.max(head.top + head.height / 2, s.top + 8), s.bottom - 8) - w.top;
        const sx = hx + (left ? -hr : hr), mx = (sx + x) / 2;
        const co = !/\bis-(solo|other|sep)\b/.test(bx.className);
        return `<path class="bx-link ${co ? 'is-co' : 'is-rel'}" data-b="${esc(bx.dataset.b)}" d="M ${sx} ${hy} C ${mx} ${hy}, ${mx} ${y}, ${x} ${y}"${co ? ' pathLength="1"' : ''}/>`;
      }).join('');
      markActiveCase();
    }
    let raf = 0;
    [L, R].forEach(side => side.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(links); }, { passive: true }));

    last = { center, activeCase, badges, coIds, egoMode: true, branch: true };
    links();
    prevSize = { w: nodeLayer.clientWidth, h: nodeLayer.clientHeight };
    // 좌우 가지형은 영역에 꼭 맞게 그리므로 확대·이동 없이 1배
    view.s = 1; view.x = graph.offsetLeft; view.y = graph.offsetTop; moved = false;
    renderFocus(S, null);
    $('#mapContext').textContent = `${center.name} 중심 · 사건 ${caseN}건`; // 인원은 제목 옆 숫자·가운데 인물 아래에, 누르기 안내는 아래 범례 줄에

    // ── 움직임: 이전 배치는 잠깐 흐려지고, 남는 사람은 날아가고, 새 상자·사람은 차례로, 곡선은 마지막에 그려짐
    const ghosts = ghostLayer();
    if (!motion) { ghosts.replaceChildren(); edgeLayer.replaceChildren(); lastSettle = 0; return; }
    const newIds = new Set($$('.node[data-id]', wrap).map(el => el.dataset.id));
    if (oldWrap) {
      oldWrap.inert = true;
      $$('[data-id], [data-case-link], [data-group]', oldWrap).forEach(el => {
        if (el.classList.contains('node') && newIds.has(el.dataset.id)) el.style.visibility = 'hidden'; // 날아가는 사람은 새 자리에서 움직임
        el.removeAttribute('data-id'); el.removeAttribute('data-case-link'); el.removeAttribute('data-group');
      });
      ghosts.replaceChildren(oldWrap);
      oldWrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-in', fill: 'forwards' }).finished.then(() => oldWrap.remove(), () => {});
    } else if (oldNodes.length) {
      const pct = new Map([...prev].map(([id, r]) => [id, [(r.left + r.width / 2 - g.left) / (g.width || 1) * 100, (r.top + r.height / 2 - g.top) / (g.height || 1) * 100]]));
      fadeOut(oldNodes, pct, newIds, 0);
    }
    if (oldEdges.length) {
      const holder = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      holder.setAttribute('class', 'edge-ghosts'); holder.style.pointerEvents = 'none';
      oldEdges.forEach(e => holder.appendChild(e));
      edgeLayer.replaceChildren(holder);
      holder.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).finished.then(() => holder.remove(), () => {});
    }
    const EASE = 'cubic-bezier(.65, 0, .35, 1)', OUT = 'cubic-bezier(.2, .8, .3, 1)', POP = 'cubic-bezier(.2, .8, .3, 1.15)';
    const flying = new Set();
    $$('.node[data-id]', wrap).forEach(el => {
      const from = prev.get(el.dataset.id); if (!from || !from.width) return;
      const d = $('.node__dot', el), to = d.getBoundingClientRect();
      const dx = from.left + from.width / 2 - to.left - to.width / 2, dy = from.top + from.height / 2 - to.top - to.height / 2, k = from.width / (to.width || 1);
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(k - 1) < .02) return;
      flying.add(el); el.classList.add('is-flying');
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 560, easing: EASE });
      d.animate([{ transform: `scale(${k})` }, { transform: 'none' }], { duration: 560, easing: EASE })
        .finished.then(() => el.classList.remove('is-flying'), () => el.classList.remove('is-flying'));
    });
    const hubEl = $('.bx-hub', wrap);
    if (!flying.has(hubEl)) hubEl.animate([{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: OUT, fill: 'backwards' });
    $('.bx-center__x', wrap)?.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 280, delay: 420, easing: OUT, fill: 'backwards' });
    $$('.bx', wrap).forEach((bx, bi) => {
      const t = 140 + bi * 45;
      $('.bx-bg', bx).animate([{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: t, easing: OUT, fill: 'backwards' });
      $$('.bx-head, .bx-solo, .bx-also', bx).forEach(el => el.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 280, delay: t + 60, easing: OUT, fill: 'backwards' }));
      $$('.node', bx).forEach((el, ci) => {
        if (!flying.has(el)) el.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 340, delay: t + 80 + Math.min(ci, 12) * 22, easing: POP, fill: 'backwards' });
      });
    });
    const paths = $$('.bx-link', wrap);
    paths.forEach((p, i) => {
      const t = 380 + i * 40;
      if (p.classList.contains('is-co')) {
        p.style.strokeDasharray = '1';
        p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 420, delay: t, easing: OUT, fill: 'backwards' })
          .finished.then(() => { p.style.strokeDasharray = ''; }, () => {});
      } else p.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: t, fill: 'backwards' });
    });
    lastSettle = Math.max(560, 380 + paths.length * 40 + 420);
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
    // 처음 화면(clock.html)의 전환이 대신 움직임을 맡을 때(MAP_SKIP_ANIM, 한 번만)는 바로 결과 배치
    const skip = window.MAP_SKIP_ANIM; window.MAP_SKIP_ANIM = false;
    if (reducedMotion() || skip) { finish(); return 0; }

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
    leaveBranch();
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
    const aid = last?.egoMode && last.activeCase ? last.activeCase.id : null;
    const active = aid ? last.badges.find(b => b.id === aid || (b.soloGroup && b.members.some(m => m.id === aid))) : null;
    $$('.group-tag[data-group]', graph).forEach(t => t.classList.toggle('is-active', !!active && last.badges[+t.dataset.group] === active));
    if (last?.branch) { // 좌우 가지형: 그 사건 상자 테두리·제목(검정)과 곡선만 진하게, 다른 상자는 그대로
      $$('.bx', nodeLayer).forEach(bx => bx.classList.toggle('is-active', !!$('.group-tag.is-active', bx)));
      $$('.bx-link', nodeLayer).forEach(p => p.classList.toggle('is-active', !!$(`.bx.is-active[data-b="${p.dataset.b}"]`, nodeLayer)));
      graph.classList.remove('has-case', 'has-solo');
      return;
    }
    $$('.solo-menu__item', groupLayer).forEach(t => t.classList.toggle('is-active', t.dataset.caseLink === aid));
    $$('.solo-stem', edgeLayer).forEach(p => p.classList.toggle('is-active', !!aid && p.dataset.case.split(' ').includes(aid))); // 지금 보는 단독 사건이면 점선도 진하게
    const ids = new Set(active?.ids || []);
    graph.classList.toggle('has-case', !!active && ids.size > 0);
    graph.classList.toggle('has-solo', !!active && ids.size === 0); // 단독 사건: 다른 사람과 잇는 선은 모두 흐리게
    $$('.edge', edgeLayer).forEach(e => e.classList.toggle('is-case', ids.has(e.dataset.to) || ids.has(e.dataset.from) && e.dataset.from !== last.center.id));
  }
  // 그 사건 무리(+중심 인물)를 한 번 강조
  function spotlightCase() {
    if (!last?.egoMode || !last.activeCase) return;
    const b = last.badges.find(v => v.id === last.activeCase.id);
    spotlight(new Set([...(b?.ids || []), last.center.id]), Math.max(0, lastSettle - 120));
  }

  // '단독 재판' 묶음 뱃지: 누르면 사건 목록이 뱃지 곁에 펼쳐짐
  function closeSoloMenu() {
    const m = document.getElementById('soloMenu'); if (!m || m.hidden) return;
    m.hidden = true; groupLayer.querySelector('[data-solo-group]')?.setAttribute('aria-expanded', 'false');
  }
  groupLayer.addEventListener('click', e => {
    const t = e.target.closest('[data-solo-group]'), m = document.getElementById('soloMenu');
    if (e.target.closest('.solo-menu__item')) return closeSoloMenu();
    if (!t || !m) return;
    e.stopPropagation();
    if (!m.hidden) return closeSoloMenu();
    m.hidden = false; t.setAttribute('aria-expanded', 'true');
    // 뱃지 아래(자리가 없으면 위)에, 관계도 밖으로 나가지 않게
    const g = graph.getBoundingClientRect(), r = t.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
    const left = Math.min(Math.max(4, r.left - g.left + r.width / 2 - w / 2), g.width - w - 4);
    const below = r.bottom - g.top + 6, top = below + h <= g.height - 4 ? below : Math.max(4, r.top - g.top - 6 - h);
    m.style.left = left / g.width * 100 + '%'; m.style.top = top / g.height * 100 + '%';
  });
  document.addEventListener('click', e => { if (!e.target.closest('#soloMenu, [data-solo-group]')) closeSoloMenu(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') closeSoloMenu(); });

  // '그 밖의 관계' 뱃지(좌우 가지형은 상자 제목): 상세를 바꾸지 않고 그 무리만 강조
  graph.addEventListener('click', e => {
    const t = e.target.closest('.group-tag--other');
    const b = t && last?.badges[+t.dataset.group];
    if (b) spotlight(new Set([...b.ids, last.center.id]));
  });

  // ── 마우스 오버 강조 ─────────────────────────
  let peekFns = null;
  function peek(id) {
    if (!peekFns) return;
    if (!id || !$(`.node[data-id="${CSS.escape(id)}"]`, nodeLayer)) { graph.classList.remove('is-hovering'); return peekFns.clear(); }
    graph.classList.add('is-hovering'); peekFns.light(id);
  }
  function bindHover() {
    if (!canHover()) return;
    let current = null;
    const clear = () => {
      $$('.is-hover, .is-peer, .is-peer-weak, .is-member', graph).forEach(el => el.classList.remove('is-hover', 'is-peer', 'is-peer-weak', 'is-member'));
      $$('.edge.is-lit', graph).forEach(el => el.classList.remove('is-lit'));
      graph.classList.remove('is-pointing', 'is-bx-pointing'); current = null;
    };
    const light = id => {
      if (id === current) return;
      clear(); current = id;
      if (last?.branch) { // 좌우 가지형: 그 사람이 함께 있는 사건 상자만 또렷하게(나머지 상자는 흐리게)
        graph.classList.add('is-bx-pointing');
        $$('.node', nodeLayer).forEach(n => n.classList.toggle('is-hover', n.dataset.id === id));
        $$('.bx', nodeLayer).forEach(bx => {
          const b = last.badges[+bx.dataset.b];
          bx.classList.toggle('is-member', id === last.center.id || !!b && (b.ids.includes(id) || (b.sep || []).includes(id) || b.place.some(p => p.id === id)));
        });
        return;
      }
      graph.classList.add('is-pointing');
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
    // 상세 '연결된 인물'에 마우스를 올렸을 때(main.js): 관계도에 그 사람이 있으면 같은 방식으로 표시
    peekFns = { light, clear };
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

  // ── 사건 뱃지 말풍선 ─────────────────────────
  // 마우스를 올리거나(키보드로 고르면) 그 사건이 무엇인지·왜 이 사람들이 한 무리인지·특검이 기소한 혐의·지금 단계를 짧게.
  // 기소 내용은 '특검이 기소한 혐의'로 밝혀 법원 판단과 섞이지 않게 함. 터치 화면은 누르면 바로 상세가 열리므로 띄우지 않음
  function bindCaseTip() {
    if (!canHover()) return;
    const tip = document.createElement('div');
    tip.className = 'case-tip'; tip.setAttribute('role', 'tooltip'); tip.id = 'caseTip'; tip.hidden = true;
    document.body.appendChild(tip);
    let timer = 0, shownFor = null;
    const names = ids => ids.map(id => Model.get(id).name);
    const wa = name => { const c = String(name).charCodeAt(String(name).length - 1) - 0xac00; return c >= 0 && c <= 11171 && c % 28 ? '과' : '와'; }; // 받침 있으면 '과'
    const listNames = (ids, n = 4) => { const a = names(ids); return a.slice(0, n).join('·') + (a.length > n ? ` 외 ${a.length - n}명` : ''); };
    function content(b, tag) {
      const c = last.center;
      const on = tag.classList.contains('is-active'); // 지금 오른쪽 상세에서 보는 사건
      const where = isMobile() ? '아래' : '오른쪽'; // 좁은 창은 상세가 아래 시트
      if (b.soloGroup) return `
        <p class="case-tip__eyebrow">단독 재판 · ${b.members.length}건</p>
        <p class="case-tip__title">${esc(c.name)} 혼자 피고인인 재판</p>
        <p class="case-tip__why">${esc(b.members.map(m => m.label).join(' · '))}</p>
        <p class="case-tip__hint">누르면 사건 목록이 열립니다 · 고르면 ${where}에 그 재판의 상세가 열립니다</p>`;
      if (b.other) return `
        <p class="case-tip__eyebrow">그 밖의 관계 · ${b.ids.length}명</p>
        <p class="case-tip__title">같은 재판은 아닌 사람들</p>
        <p class="case-tip__why">${esc(c.name)}${wa(c.name)} 다른 사건으로 기소됐거나, 가족·별도 관계로 이어진 사람들입니다. 함께 재판받지 않습니다.</p>
        <p class="case-tip__hint">누르면 이 사람들만 강조합니다</p>`;
      const r = c.records.find(v => v.id === b.id);
      if (!r) return '';
      const mates = b.ids.filter(id => id !== c.id);
      const sep = (b.sep || []).filter(id => !last.coIds.has(id));
      const why = (b.solo
        ? `${esc(c.name)} 혼자 피고인인 재판입니다.`
        : !mates.length ? `${esc(c.name)}${wa(c.name)} 함께 재판받는 ${b.total}명은 지금 조건(검색·특검)에서 숨겨져 있습니다.`
        : `${esc(c.name)}${wa(c.name)} 같은 사건으로 함께 기소돼 재판받는 사람들입니다 — ${esc(listNames(mates))}${b.total > mates.length ? ` 등 ${b.total}명` : ''}.`)
        + (sep.length ? ` 같은 사건으로 따로 기소돼 별도로 재판받는 사람(${last.branch ? '회색 테두리' : '점선'}): ${esc(listNames(sep))}.` : '');
      const charges = (r.charges || []).slice(0, 3).map(ch => `<li><b>${esc(ch.name)}</b>${ch.act ? `<span>${esc(ch.act)}</span>` : ''}</li>`).join('');
      const more = (r.charges || []).length > 3 ? `<p class="case-tip__more">외 ${r.charges.length - 3}개 혐의</p>` : '';
      return `
        <p class="case-tip__eyebrow">${esc(r.agency)}${!b.solo ? ` · ${esc(c.name)} 외 ${b.total}명` : ' · 단독 재판'}</p>
        <p class="case-tip__title">${esc(r.title || r.label)}</p>
        <p class="case-tip__why">${why}</p>
        ${charges ? `<p class="case-tip__label">특검이 기소한 혐의</p><ul class="case-tip__charges">${charges}</ul>${more}` : ''}
        ${r.status ? `<p class="case-tip__status"><span>지금</span>${esc(r.status)}</p>` : ''}
        <p class="case-tip__hint">${on ? `지금 ${where}에서 보고 있는 재판입니다 · 다시 누르면 강조를 풉니다` : `누르면 ${where}에 이 재판의 상세가 열립니다`}</p>`;
    }
    function place(tag) {
      const t = tag.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, gap = 10, pad = 8;
      const fitsBelow = t.bottom + gap + h <= innerHeight - pad, fitsAbove = t.top - gap - h >= pad;
      tip.classList.remove('is-above', 'is-side');
      if (fitsBelow || fitsAbove) { // 위·아래: 꼬리가 뱃지 가운데를 가리킴
        const left = Math.min(Math.max(pad, t.left + t.width / 2 - w / 2), innerWidth - w - pad);
        tip.style.left = left + 'px';
        tip.style.top = (fitsBelow ? t.bottom + gap : t.top - gap - h) + 'px';
        tip.style.setProperty('--ax', (t.left + t.width / 2 - left) + 'px');
        tip.classList.toggle('is-above', !fitsBelow);
        return;
      }
      // 위·아래 어디에도 다 들어가지 않는 긴 말풍선: 뱃지 옆(넓은 쪽)에 두고 화면 안으로 세로 위치를 맞춤
      const right = innerWidth - t.right >= t.left;
      const left = right ? Math.min(t.right + gap, innerWidth - w - pad) : Math.max(pad, t.left - gap - w);
      const top = Math.min(Math.max(pad, t.top + t.height / 2 - h / 2), Math.max(pad, innerHeight - h - pad));
      tip.style.left = left + 'px'; tip.style.top = top + 'px';
      tip.style.setProperty('--ay', (t.top + t.height / 2 - top) + 'px');
      tip.classList.add('is-side'); tip.classList.toggle('is-left', !right);
    }
    function show(tag) {
      const b = last?.badges[+tag.dataset.group];
      if (!b || !last.egoMode) return hide();
      if (shownFor === tag) return;
      const html = content(b, tag);
      if (!html) return hide();
      shownFor = tag; tip.innerHTML = html; tip.hidden = false; tip.classList.remove('is-in');
      tag.setAttribute('aria-describedby', 'caseTip');
      place(tag);
      requestAnimationFrame(() => tip.classList.add('is-in'));
    }
    function hide() {
      clearTimeout(timer);
      if (shownFor) shownFor.removeAttribute('aria-describedby');
      shownFor = null; tip.hidden = true; tip.classList.remove('is-in');
    }
    // 사건 뱃지(좌우 가지형은 상자 제목·단독 재판 이름표)는 관계도 어디에 있든 같은 말풍선
    graph.addEventListener('mouseover', e => {
      const tag = e.target.closest('.group-tag'); if (!tag) return;
      clearTimeout(timer); timer = setTimeout(() => show(tag), shownFor ? 0 : 160);
    });
    graph.addEventListener('mouseout', e => {
      const tag = e.target.closest('.group-tag'); if (!tag || tag.contains(e.relatedTarget)) return;
      clearTimeout(timer); timer = setTimeout(hide, 80);
    });
    graph.addEventListener('focusin', e => { const tag = e.target.closest('.group-tag'); if (tag && tag.matches(':focus-visible')) show(tag); });
    graph.addEventListener('focusout', hide);
    // 누르거나, 관계도가 다시 그려지거나 움직이면 닫음
    ['click', 'wheel', 'pointerdown'].forEach(ev => graph.addEventListener(ev, hide, { passive: true }));
    addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
    const mo = new MutationObserver(() => { if (shownFor && !shownFor.isConnected) hide(); });
    mo.observe(groupLayer, { childList: true }); mo.observe(nodeLayer, { childList: true });
  }
  bindCaseTip();

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
  // 데스크톱 기본 보기는 1배(인물 크기 유지). 배치는 그릴 때 실제 영역 크기에 맞춰 다시 짜므로(구도 변경),
  // 관계도 칸이 영역보다 커서 잘리는 예외적인 경우에만 줄임
  function fitDesktop() {
    view.s = 1; view.x = graph.offsetLeft; view.y = graph.offsetTop;
    const vw = pane.clientWidth - graph.offsetLeft, vh = pane.clientHeight - graph.offsetTop;
    const s = Math.min(1, vw / graph.offsetWidth, vh / graph.offsetHeight);
    if (s < .999) view.s = Math.max(.5, s);
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
    if (graph.classList.contains('is-branch')) { resetView(); return; }
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
    if (graph.classList.contains('is-branch')) return; // 좌우 가지형은 영역에 꼭 맞게 그리므로 끌어 옮기지 않음(기둥 안 스크롤은 그대로)
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
    try { return fn(...a); } finally { graph.style.transform = graph.classList.contains('is-branch') ? '' : t; }
  };
  const render = unscaled(drawMap), renderIntro = unscaled(drawIntro);

  // 사건 강조 해제 (다시 그리지 않음)
  function clearCase() {
    if (!last) return;
    last.activeCase = null;
    markActiveCase();
  }

  // 이번에 좌우 가지형으로 그리는가 ('○○ 중심' 줄 표시 여부를 그리기 전에 정할 때 씀)
  const wantsBranch = () => useBranch(graph.offsetWidth);

  return { render, renderIntro, centerOnMobile, spotlightCase, clearCase, wantsBranch, peek };
})();
