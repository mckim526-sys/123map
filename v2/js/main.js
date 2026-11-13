// 앱 상태 · 라우팅 · 이벤트 연결
//
// 주소(해시) 체계
//   #start · 빈 주소        처음 화면 clock.html(12·3 이후 흐른 시간 + 두 인물)로 보냄
//   #map                   전체 관계도
//   #person/<id>[/<case>]  인물 재판 상세
(() => {
  const S = { view: 'map', agency: 'all', query: '', selected: Model.ROOT_ID, caseId: '', detailOpen: false, intro: true, sheet: 'half' };
  // sheet: 모바일 상세 시트 높이 — 'half'(관계도가 위에 보임) / 'full'
  let graphSize = '';

  // ── 필터 칩 생성 ──
  $('#agencyFilter').innerHTML = ['all', ...Model.agencies]
    .map(a => `<button data-agency="${esc(a)}" class="${a === 'all' ? 'is-active' : ''}">${a === 'all' ? '전체' : esc(a)}</button>`).join('');
  $('[data-bind="total"]').textContent = Model.people.length;

  // ── 렌더링 ──
  function render() {
    const home = S.agency === 'all' && !S.detailOpen && !S.query;
    // 관계도 높이를 바꾸는 범례·아래 영역 표시를 먼저 정함 → 그린 뒤 크기가 바뀌어 한 번 더 그리는 일이 없게
    $('#mapLegend').hidden = S.intro && home; // 오프닝에는 같은 재판 선이 없음
    // 모바일 오프닝은 범례가 숨겨지고 안내문도 모바일에서 숨겨 빈 띠가 남으므로 아래 영역 전체를 숨김
    $('#mapFoot').hidden = S.view !== 'map' || (S.intro && home && isMobile());
    $('#mapFocus').hidden = !(S.detailOpen && S.view === 'map'); // '○○ 중심' 줄도 관계도 높이에 영향
    // 이번에 그릴 때의 관계도 크기를 기록 → 같은 크기로 크기 감시가 또 그리지 않게
    const gEl = $('#graph'); // 모바일 확대·축소(transform)와 무관한 실제 크기
    graphSize = gEl.offsetWidth + 'x' + gEl.offsetHeight;
    if (home) S.selected = Model.ROOT_ID;
    const list = Model.filterPeople(S.agency, S.query);
    $('#resultCount').textContent = `${list.length}명`; // 타임라인이면 아래에서 일정 건수로 바꿈
    if (S.intro && home) MapView.renderIntro(); else MapView.render(S, list);
    const sel = S.detailOpen ? { id: S.selected, caseId: S.caseId } : null;
    ListView.render(list, S.agency, sel);
    TimelineView.render(list, S.agency, sel);
    if (S.view === 'timeline') $('#resultCount').textContent = `${TimelineView.count()}건`;
    NightView.render();
    if (S.view === 'night') $('#resultCount').textContent = `장소 ${NightView.count()}곳`;
    if (S.view === 'map') $('#resultCount').textContent = `${$$('#nodeLayer .node').length}명`; // 관계도: 실제로 그려진 인원
    // 목록·타임라인에서는 관계도 안내 대신 보기별 설명을 표시
    if (S.view === 'list') $('#mapContext').textContent = '인물마다 대표 사건의 최근 판단과 진행 단계를 보여 줍니다 · 누르면 재판 상세가 열립니다';
    if (S.view === 'timeline') $('#mapContext').textContent = '선고·확정·결심·예정 일정을 달력으로 · 날짜를 누르면 그날 일정을 모아 봅니다 · 함께 선고된 피고인은 한 항목';
    if (S.view === 'night') $('#mapContext').textContent = '2024년 12월 3일 밤, 어디서 무슨 일이 있었나 · 장소를 누르면 그곳의 일과 이어지는 재판을 봅니다';
    $('#viewTitle').textContent = { map: '인물·사건 연결 지도', list: '재판 목록', timeline: '재판 타임라인', night: '그날 밤, 장소별로' }[S.view];
  }

  // 목록·타임라인으로 넘어가면 선택한 인물이 보이는 위치로 스크롤
  function revealSelection() {
    if (!S.detailOpen) return;
    const pane = S.view === 'list' ? $('#listPane') : S.view === 'timeline' ? $('#timelinePane') : null;
    if (!pane) return; // 관계도 보기에서는 스크롤할 목록이 없음
    const target = S.view === 'list' ? $('.row.is-selected', pane) : $('.tl-item.is-mine', pane); // 타임라인: 그 인물의 첫 일정
    if (!target) return;
    pane.scrollTop = target.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop - pane.clientHeight / 3;
  }

  // 짧은 안내
  let toastT;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 3200);
  }

  // 특검 필터 적용 — 상세가 열려 있으면 그 인물의 해당 특검 사건으로 바꾸고, 없으면 상세를 닫음
  function setAgencyChips() {
    $$('[data-agency]').forEach(v => v.classList.toggle('is-active', v.dataset.agency === S.agency));
  }
  function applyAgency(agency) {
    S.agency = agency;
    setAgencyChips();
    leaveIntro();
    if (S.detailOpen) {
      const p = Model.get(S.selected);
      // 지금 보던 사건이 그 특검 사건이면 그대로, 아니면 그 특검의 첫 사건
      const rec = p.records.find(r => r.id === S.caseId && (agency === 'all' || r.agency === agency))
        || p.records.find(r => r.agency === agency);
      if (rec) {
        history.replaceState(null, '', `#person/${p.id}/${rec.id}`);
        return select(p.id, rec.id);
      }
      toast(`${p.name}에게는 ${agency} 사건이 없어 상세를 닫았습니다`);
      S.selected = Model.agencyRoot(agency);
      closeDetail();
    } else {
      S.selected = Model.agencyRoot(agency);
      render();
    }
    MapView.centerOnMobile(S.agency);
  }

  const VIEWS = ['map', 'list', 'timeline', 'night'];

  // ── 주소 ──
  // 시작 화면을 벗어나는 조작(필터·검색 등)은 주소를 #map 으로 바꿔 둠
  const leaveIntro = () => {
    S.intro = false;
    if (location.hash === '#start' || !location.hash) history.replaceState(null, '', '#map');
  };

  // #person/<id>/<caseId> — 존재하지 않는 인물이면 null
  function personRoute(hash) {
    const parts = String(hash || '').split('/');
    if (parts[0] !== '#person' || !parts[1] || parts.length > 3) return null;
    try {
      const id = decodeURIComponent(parts[1]), cid = parts[2] ? decodeURIComponent(parts[2]) : '';
      const p = Model.people.find(v => v.id === id);
      if (!p?.records?.length) return null;
      return { id: p.id, caseId: (p.records.find(r => r.id === cid) || p.records[0]).id };
    } catch { return null; }
  }

  // 현재 주소를 화면 상태로 반영
  function applyRoute() {
    const person = personRoute(location.hash);
    if (person) return select(person.id, person.caseId);
    const view = location.hash.slice(1) || 'map';
    if (VIEWS.includes(view) && view !== S.view) setView(view);
    if (!location.hash || location.hash === '#start') { // 처음 화면은 clock (안에 들어가 있으면 관계도)
      if (window.top === window) return location.replace('../clock.html');
      history.replaceState(null, '', '#map');
    }
    const start = !VIEWS.includes(view);
    if (start && S.view !== 'map') setView('map');
    if (start) history.replaceState(null, '', '#map'); // 알 수 없는 주소는 전체 관계도
    if (start) {
      S.agency = 'all'; S.query = ''; $('#searchInput').value = '';
      $$('[data-agency]').forEach(v => v.classList.toggle('is-active', v.dataset.agency === 'all'));
    }
    S.intro = false; // 두 인물 오프닝은 clock.html이 맡음
    hideDetail();
    render();
    MapView.centerOnMobile(S.agency);
  }

  // ── 상세 열기/닫기 ──
  function select(id, cid) {
    const p = Model.get(id);
    S.selected = p.id;
    const rec = p.records.find(r => r.id === cid) || p.records.find(r => r.agency === S.agency) || p.records[0];
    if (!rec) return;
    if ($('#compareDialog').open) $('#compareDialog').close();
    S.caseId = rec.id; S.detailOpen = true; S.intro = false;
    if (!document.body.classList.contains('has-detail')) S.sheet = 'half'; // 처음 열 때는 반 높이
    document.body.classList.add('has-detail');
    setSheet(S.sheet);
    DetailView.show(p, rec, S.agency);
    render();
    revealSelection();
    MapView.centerOnMobile(S.agency);
  }

  function open(id, cid) {
    $('#searchInput').value = ''; S.query = '';
    const p = Model.get(id);
    history.pushState(null, '', `#person/${p.id}${cid ? '/' + cid : ''}`);
    select(p.id, cid);
  }

  function hideDetail() {
    S.detailOpen = false;
    document.body.classList.remove('has-detail', 'sheet-half', 'sheet-full');
    $('#sheetBackdrop').hidden = true;
  }

  // ── 모바일 상세 시트 ──
  // 반 높이: 위쪽에 관계도가 보이고 조작 가능(배경막 없음) / 전체: 배경막을 깔고 화면을 덮음
  function setSheet(state) {
    S.sheet = state;
    document.body.classList.toggle('sheet-half', state === 'half');
    document.body.classList.toggle('sheet-full', state === 'full');
    $('#sheetBackdrop').hidden = !(S.detailOpen && state === 'full');
    $('.sheet-handle')?.setAttribute('aria-expanded', state === 'full');
  }

  // 손잡이·머리 막대를 끌어 올리면 전체, 내리면 반 높이 → 더 내리면 닫힘. 손잡이를 누르면 반/전체 전환
  (() => {
    const panel = $('#detail');
    let drag = null;
    panel.addEventListener('pointerdown', e => {
      if (!isMobile() || !S.detailOpen) return;
      if (!e.target.closest('.detail__bar') || (e.target.closest('button') && !e.target.closest('.sheet-handle'))) return;
      drag = { y: e.clientY, top: panel.getBoundingClientRect().top, moved: 0 };
      panel.classList.add('is-dragging');
      panel.setPointerCapture(e.pointerId);
    });
    panel.addEventListener('pointermove', e => {
      if (!drag) return;
      drag.moved = e.clientY - drag.y;
      panel.style.top = Math.max(48, Math.min(innerHeight - 96, drag.top + drag.moved)) + 'px';
    });
    const end = e => {
      if (!drag) return;
      const { moved } = drag, onHandle = e.target.closest?.('.sheet-handle');
      drag = null;
      panel.classList.remove('is-dragging');
      panel.style.top = '';
      if (Math.abs(moved) < 8) { if (onHandle) setSheet(S.sheet === 'full' ? 'half' : 'full'); return; }
      if (moved < -40) return setSheet('full');
      if (moved > 60) return S.sheet === 'full' ? setSheet('half') : closeDetail();
    };
    panel.addEventListener('pointerup', end);
    panel.addEventListener('pointercancel', end);
  })()

  // 상세를 닫으면 지금 보기의 주소(#map · #list · #timeline · #night)로
  function closeDetail() {
    hideDetail();
    history.replaceState(null, '', '#' + S.view);
    S.intro = false;
    render();
    MapView.centerOnMobile(S.agency);
  }

  // 사건 강조만 해제: 관계도 선은 모두 평소대로, 뱃지·사건 탭의 검정 표시도 끔 (상세 내용은 그대로)
  function clearCase() {
    MapView.clearCase();
    $$('.case-tabs .is-active').forEach(b => { b.classList.remove('is-active'); b.setAttribute('aria-selected', 'false'); });
  }

  Relation.setContext({ open, agency: () => S.agency });

  // ── 클릭 위임 ──
  document.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-intro-skip]')) { history.pushState(null, '', '#map'); return applyRoute(); }
    if (t.closest('[data-close-detail]') || t.closest('#sheetBackdrop')) return closeDetail();
    const edge = t.closest('[data-edge]');
    if (edge) return Relation.open(edge.dataset.from, edge.dataset.to, edge, true);
    const chip = Relation.chipTarget(t);
    if (chip) return Relation.open(chip.a, chip.b, chip.anchor, true);
    // 두 번 누르면 취소: 이미 고른 사건(뱃지·탭)을 다시 누르면 사건 강조 해제
    if (t.closest('.group-tag.is-active[data-case-link], .case-tabs .is-active[data-case]')) return clearCase();
    const caseLink = t.closest('[data-case-link]');
    if (caseLink) return open(caseLink.dataset.id, caseLink.dataset.caseLink);
    const person = t.closest('[data-id]');
    // 두 번 누르면 취소: 관계도에서 지금 선택한 인물을 다시 누르면 선택 해제(상세 닫힘)
    if (person && S.detailOpen && person.dataset.id === S.selected && person.closest('#nodeLayer')) return closeDetail();
    if (person) return open(person.dataset.id);
    const tab = t.closest('[data-case]');
    if (tab) return open(S.selected, tab.dataset.case); // 관계도는 다시 배치하지 않고 그 사건 무리만 강조
    if (t.closest('[data-compare]')) {
      const p = Model.get(S.selected);
      DetailView.compare(p, p.records.find(r => r.id === S.caseId), S.agency);
    }
  });

  // 특검 필터
  $('#agencyFilter').addEventListener('click', e => {
    const b = e.target.closest('[data-agency]');
    if (b) applyAgency(b.dataset.agency);
  });

  // 검색 (입력 지연 120ms)
  let typing;
  $('#searchInput').addEventListener('input', e => {
    clearTimeout(typing);
    typing = setTimeout(() => {
      S.query = e.target.value.trim();
      if (S.query) leaveIntro();
      // 검색은 왼쪽 조건 → 선택한 인물이 결과에 없으면 상세를 닫고 검색 결과를 보여 줌 (특검 필터와 같은 규칙)
      if (S.detailOpen && S.query && !Model.filterPeople(S.agency, S.query).some(p => p.id === S.selected)) return closeDetail();
      render();
    }, 120);
  });

  // 보기 전환 (페이지는 스크롤하지 않으므로 각 영역의 스크롤만 처음으로)
  // 보기 전환 · 주소: 관계도 #map, 그 밖의 보기 #list #timeline #night (인물 주소일 때는 주소를 그대로 둠)
  function setView(view) {
    S.view = VIEWS.includes(view) ? view : 'map';
    $$('[data-view]').forEach(v => { const on = v.dataset.view === S.view; v.classList.toggle('is-active', on); v.setAttribute('aria-pressed', on); });
    $('#mapPane').hidden = S.view !== 'map';
    $('#listPane').hidden = S.view !== 'list';
    $('#timelinePane').hidden = S.view !== 'timeline';
    $('#nightPane').hidden = S.view !== 'night';
  }
  $$('[data-view]').forEach(b => b.addEventListener('click', () => {
    setView(b.dataset.view);
    if (S.view !== 'map') S.intro = false;
    if (!personRoute(location.hash)) history.replaceState(null, '', '#' + S.view);
    render();
    $('#listPane').scrollTop = 0; $('#timelinePane').scrollTop = 0;
    revealSelection();
  }));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && S.detailOpen && !document.querySelector('dialog[open]')) closeDetail();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset?.edge !== undefined) {
      e.preventDefault(); Relation.open(e.target.dataset.from, e.target.dataset.to, e.target, true);
    }
  });

  addEventListener('hashchange', applyRoute);

  // 창 크기 등으로 관계도 크기가 실제로 바뀐 경우에만 다시 배치
  let resizeT;
  new ResizeObserver(() => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      const g = $('#graph'), key = g.offsetWidth + 'x' + g.offsetHeight;
      if (g.offsetWidth && g.offsetHeight && key !== graphSize) render();
    }, 80);
  }).observe($('#graph'));

  Dialogs.init();
  applyRoute();
})();
