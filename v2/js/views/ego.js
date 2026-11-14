// 모바일 관계도(목록형, 2026-11-14 모바일 시안 반영): 그래프 대신 "한 사람 + 바로 연결된 사람"을 사건 카드로 보여 줌.
//  · 인물 중심: 중심 인물의 사건마다 카드 한 장, 카드 안에 함께 재판받는 사람. 사람을 누르면 그 사람이 중심이 됨(지나온 경로 유지)
//  · 사건 중심: 특검별 사건 목록 → 펼치면 피고인과 각자의 최근 판단
// 선 대신 "같은 카드 안에 있다"가 곧 연결. 연결은 공모·유죄를 뜻하지 않음.
const EgoView = (() => {
  const pane = $('#egoPane');
  const shortLabel = t => String(t || '').split(' · ')[0];
  const PENDING = /미확인|확인 중|대조 중|해당 없음|미도달|예정/;
  const VERDICT = /징역|금고|벌금|무죄|유죄|공소기각|집행유예|선고유예|무기|사형|면소|기각|확정/;
  const PREVIEW = 8; // 카드에 처음 보이는 인원 (넘으면 "+N명 더")
  const STARTS = ['yoon', 'keon', 'kim', 'myung', 'park-jh'];

  let trail = [];          // 지나온 중심 인물 id
  let tab = 'person';      // 'person' | 'case'
  let lastAgency = 'all';
  const expanded = new Set(); // "+N명 더"를 펼친 카드
  const openCases = new Set(); // 사건 중심에서 펼친 사건

  const cur = () => trail[trail.length - 1];
  function go(id) {
    const at = trail.indexOf(id);
    trail = at >= 0 ? trail.slice(0, at + 1) : [...trail, id].slice(-8);
    expanded.clear();
    pane.scrollTop = 0;
  }
  function back(i) { trail = trail.slice(0, i + 1); expanded.clear(); pane.scrollTop = 0; }
  function reset(id) { trail = [id]; expanded.clear(); pane.scrollTop = 0; }
  const setTab = t => { tab = t; pane.scrollTop = 0; };

  // 최근 법원 판단 (재판 목록과 같은 기준)
  function latest(rec) {
    let out = null;
    (rec.stages || []).forEach((s, i) => { if (VERDICT.test(s[0] || '') && !PENDING.test(s[0]) && !/예정/.test(s[2] || '')) out = `${stageName(i + 1)} ${s[0]}`; });
    return out;
  }
  function steps(rec) {
    const p = Progress.of(rec);
    const bars = [1, 2, 3].map(n => {
      const st = p.stage === null ? '' : n < p.stage ? 'is-done' : n === p.stage ? (p.phase === 'final' ? 'is-final' : 'is-current') : '';
      return `<i class="${st}"></i>`;
    }).join('');
    return `<span class="mini-steps" aria-hidden="true">${bars}</span>`;
  }

  // ── 인물 중심 ──
  function clusters(S, center) {
    const pool = Model.filterPeople(S.agency, '');
    const inPool = new Set(pool.map(p => p.id));
    const recs = center.records.filter(r => S.agency === 'all' || r.agency === S.agency);
    const cases = recs.map(r => ({
      rec: r, label: shortLabel(r.label),
      people: [...Model.trialmates(center, r)].filter(id => inPool.has(id)).map(id => Model.get(id)),
    })); // 사건 순서는 데이터 순서 그대로 (본류가 먼저)
    const co = new Set(cases.flatMap(c => c.people.map(p => p.id)));
    const others = pool.filter(p => p.id !== center.id && !co.has(p.id) && Model.linkLabel(center, p, S.agency))
      .map(p => ({ p, why: Model.linkLabel(center, p, S.agency) }));
    return { cases, others, total: co.size + others.length };
  }

  function tile(p, why, sel) {
    return `<button class="ego-tile${sel === p.id ? ' is-selected' : ''}" data-ego="${esc(p.id)}" aria-label="${esc(p.name)} 중심으로 보기">
      ${avatar(p, 'ego-tile__ava')}<b>${esc(p.name)}</b><span>${esc(why || p.role)}</span></button>`;
  }
  function tiles(key, items, sel) {
    const open = expanded.has(key) || items.length <= PREVIEW;
    const shown = open ? items : items.slice(0, PREVIEW - 1);
    const more = open ? '' : `<button class="ego-tile ego-tile--more" data-ego-more="${esc(key)}"><span class="ego-tile__ava">+${items.length - shown.length}</span><b>더 보기</b></button>`;
    return `<div class="ego-tiles">${shown.map(v => tile(v.p || v, v.why, sel)).join('')}${more}</div>`;
  }

  function personView(S) {
    const center = Model.get(cur());
    const { cases, others, total } = clusters(S, center);
    const activeCase = S.detailOpen && S.selected === center.id ? S.caseId : '';
    const head = trail.length > 1
      ? `<nav class="ego-trail" aria-label="지나온 인물">${trail.map((id, i) => {
          const p = Model.get(id), last = i === trail.length - 1;
          return `${i ? '<i aria-hidden="true">›</i>' : ''}<button data-ego-back="${i}"${last ? ' aria-current="true"' : ''}>${esc(p.name)}</button>`;
        }).join('')}</nav>`
      : `<nav class="ego-trail ego-trail--start" aria-label="출발 인물"><span>출발</span>${STARTS.map(id => Model.get(id))
          .filter(p => S.agency === 'all' || p.agencies.includes(S.agency))
          .map(p => `<button data-ego-reset="${esc(p.id)}"${p.id === center.id ? ' aria-current="true"' : ''}>${esc(p.name)}</button>`).join('')}</nav>`;

    const card = c => {
      const r = c.rec, on = r.id === activeCase;
      const body = c.people.length
        ? tiles(r.id, c.people.map(p => ({ p })), S.detailOpen ? S.selected : '')
        : `<p class="ego-solo">함께 재판받는 사람 없이 단독으로 재판받습니다</p>`;
      return `<section class="ego-card${on ? ' is-active' : ''}">
        <button class="ego-card__head" data-id="${esc(center.id)}" data-case-link="${esc(r.id)}" aria-label="${esc(c.label)} 재판 상세 보기">
          <span><b>${esc(c.label)}</b><span class="caption">${esc(r.agency)} · ${esc(r.status)}</span></span>
          <span class="ego-card__n">${c.people.length ? `${c.people.length}명` : '단독'}</span><i aria-hidden="true">›</i>
        </button>${body}</section>`;
    };
    const otherCard = others.length ? `<section class="ego-card">
        <div class="ego-card__head is-static"><span><b>그 밖의 관계</b><span class="caption">다른 사건·가족 관계 · 공모나 유죄를 뜻하지 않음</span></span><span class="ego-card__n">${others.length}명</span></div>
        ${tiles('__other', others, S.detailOpen ? S.selected : '')}</section>` : '';

    return `${head}
      <section class="ego-center">
        ${avatar(center, 'ego-center__ava')}
        <div class="ego-center__txt"><b>${esc(center.name)}</b><span class="caption">${esc(center.role)}</span>
          <span class="caption">사건 ${center.records.length}건 · 연결 ${total}명</span></div>
        <button class="btn btn--sm btn--secondary" data-id="${esc(center.id)}">재판 상세</button>
      </section>
      <p class="ego-hint">${total ? '사람을 누르면 그 사람 중심으로, 사건 이름을 누르면 재판 상세 · 같은 카드는 같은 사건·관계일 뿐 공모나 유죄를 뜻하지 않습니다' : '이 조건에서 연결된 사람이 없습니다'}</p>
      ${cases.map(card).join('')}${otherCard}`;
  }

  // ── 검색 결과 (인물 중심 탭) ──
  function searchView(list) {
    if (!list.length) return '<p class="empty">검색 결과가 없습니다.</p>';
    return `<p class="ego-hint">검색 결과 ${list.length}명 · 누르면 그 사람 중심으로 봅니다</p>
      <section class="ego-card">${tiles('__search', list.map(p => ({ p })), '')}</section>`;
  }

  // ── 사건 중심 ──
  function caseGroups(list) {
    const inList = new Set(list.map(p => p.id));
    const map = new Map();
    Model.people.forEach(p => p.records.forEach(r => {
      const key = r.family ? r.agency + ':' + r.family : r.agency + ':' + r.label;
      if (!map.has(key)) map.set(key, { key, agency: r.agency, label: shortLabel(r.label), rows: new Map() });
      map.get(key).rows.set(p.id, { p, r });
    }));
    return [...map.values()]
      .map(g => ({ ...g, rows: [...g.rows.values()] }))
      .filter(g => g.rows.some(v => inList.has(v.p.id)));
  }
  function caseView(S, list) {
    const groups = caseGroups(list);
    if (!groups.length) return '<p class="empty">검색 결과가 없습니다.</p>';
    const agencies = Model.agencies.filter(a => S.agency === 'all' || a === S.agency);
    return `<p class="ego-hint">사건 ${groups.length}건 · 사건을 펼치면 피고인과 각자의 최근 판단이 보입니다</p>` + agencies.map(a => {
      const gs = groups.filter(g => g.agency === a).sort((x, y) => y.rows.length - x.rows.length || x.label.localeCompare(y.label, 'ko'));
      if (!gs.length) return '';
      return `<h3 class="ego-agency">${esc(a)} <span>${gs.length}건</span></h3>` + gs.map(g => {
        const stack = g.rows.slice(0, 4).map(v => avatar(v.p, 'ava--sm')).join('');
        const rows = g.rows.map(({ p, r }) => {
          const v = latest(r);
          const on = S.detailOpen && S.selected === p.id && S.caseId === r.id;
          return `<button class="ego-row${on ? ' is-selected' : ''}" data-id="${esc(p.id)}" data-case-link="${esc(r.id)}">
            ${avatar(p, 'ava--md')}<span class="ego-row__who"><b>${esc(p.name)}</b><span class="caption">${esc(p.role)}</span></span>
            <span class="ego-row__v${v ? '' : ' is-pending'}">${steps(r)}<span>${esc(v || '선고 전')}</span></span></button>`;
        }).join('');
        return `<details class="ego-case" data-case-key="${esc(g.key)}"${openCases.has(g.key) ? ' open' : ''}>
          <summary><span class="ego-case__stack">${stack}</span><span class="ego-case__txt"><b>${esc(g.label)}</b><span class="caption">${g.rows.length === 1 ? '단독' : `${g.rows.length}명`}</span></span><i aria-hidden="true">›</i></summary>
          <div class="ego-case__rows">${rows}</div></details>`;
      }).join('');
    }).join('');
  }

  function render(S, list) {
    // 중심 인물 맞추기: 특검이 바뀌어 중심 인물이 그 특검에 없으면 그 특검의 대표 인물로
    if (!trail.length) trail = [Model.agencyRoot(S.agency)];
    if (S.agency !== lastAgency) {
      lastAgency = S.agency;
      if (S.agency !== 'all' && !Model.get(cur()).agencies.includes(S.agency)) reset(Model.agencyRoot(S.agency));
    }
    // 목록·타임라인 등에서 인물을 고르면 그 사람이 중심
    if (S.detailOpen && cur() !== S.selected) go(S.selected);

    const seg = `<div class="ego-seg segmented" role="tablist" aria-label="관계 보기 방식">
      <button role="tab" data-ego-tab="person" class="${tab === 'person' ? 'is-active' : ''}" aria-selected="${tab === 'person'}">인물 중심</button>
      <button role="tab" data-ego-tab="case" class="${tab === 'case' ? 'is-active' : ''}" aria-selected="${tab === 'case'}">사건 중심</button></div>`;
    const body = tab === 'case' ? caseView(S, list) : S.query ? searchView(list) : personView(S);
    pane.innerHTML = seg + `<div class="ego-body">${body}</div>`;

    const n = tab === 'case' ? $$('.ego-case', pane).length : S.query ? list.length : clusters(S, Model.get(cur())).total;
    $('#resultCount').textContent = tab === 'case' ? `${n}건` : `${n}명`;
    $('#mapContext').textContent = tab === 'case'
      ? '사건별로 함께 재판받는 사람과 각자의 최근 판단'
      : `${Model.get(cur()).name} 중심 · 사건마다 함께 재판받는 사람`;
  }

  // 사건 중심: 펼침 상태 기억 (다시 그려도 유지)
  pane.addEventListener('toggle', e => {
    const d = e.target.closest?.('.ego-case');
    if (!d) return;
    d.open ? openCases.add(d.dataset.caseKey) : openCases.delete(d.dataset.caseKey);
  }, true);

  return { render, go, back, reset, setTab, expand: k => expanded.add(k), center: cur };
})();
