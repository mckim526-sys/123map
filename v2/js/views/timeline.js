// 타임라인: 날짜가 기록된 심급만 모아 날짜순으로. 같은 날·같은 재판부·같은 사건 선고는 한 줄로 묶음.
const TimelineView = (() => {
  // 2024.12.3 밤 경과 (공개된 사실)
  const NIGHT = [
    ['22:27', '대통령 윤석열, 비상계엄 선포'],
    ['23:00', '계엄사령부 포고령 1호 발령'],
    ['12.4 01:01', '국회 본회의, 재석 190명 전원 찬성으로 계엄 해제 요구 결의'],
    ['12.4 04:27', '대통령, 계엄 해제 담화 발표'],
    ['12.4 04:30', '국무회의, 계엄 해제 의결'],
  ];

  const kind = (text, upcoming) => upcoming ? 'upcoming'
    : /무죄|공소기각/.test(text) ? 'acquit'
    : /확정/.test(text) ? 'final'
    : /징역|벌금|유죄|무기|사형/.test(text) ? 'guilty' : 'other';

  function collect(list, agency) {
    const today = todaySeoul();
    const groups = new Map();
    for (const p of list) for (const r of p.records) {
      if (agency !== 'all' && r.agency !== agency) continue;
      (r.stages || []).forEach((s, i) => {
        const m = String(s[2] || '').match(/(\d{4})\.(\d{2})\.(\d{2})/);
        if (!m) return;
        const upcoming = /예정/.test(s[2]) || /예정/.test(s[0]) || m[0] > today;
        if (/보도|제출|배당/.test(s[2]) && !upcoming) return; // 보도·제출일은 법원 판단이 아님
        const key = [m[0], s[1], r.family || r.id, s[0]].join('|');
        if (!groups.has(key)) groups.set(key, {
          date: new Date(+m[1], +m[2] - 1, +m[3]), ymd: m[0], text: s[0], court: s[1],
          stage: i === 2 ? '대법원' : (i + 1) + '심', label: r.label, agency: r.agency, upcoming, people: [],
        });
        const g = groups.get(key);
        if (!g.people.some(v => v.p.id === p.id)) g.people.push({ p, caseId: r.id });
      });
    }
    return [...groups.values()];
  }

  const KIND_LABEL = { upcoming: '예정', acquit: '무죄', final: '확정', guilty: '유죄', other: '절차' };
  const kindLabel = (k, text) => k === 'acquit' && /공소기각/.test(text) ? '공소기각' : KIND_LABEL[k];
  const WEEK = '일월화수목금토';
  const dday = date => {
    const [y, m, d] = todaySeoul().split('.').map(Number);
    const n = Math.round((date - new Date(y, m - 1, d)) / 864e5);
    return n === 0 ? '오늘' : n > 0 ? `D-${n}` : '';
  };

  // 선택한 인물 연동: sel = { id, caseId }. 일정을 좁히지 않고 그 인물 일정만 강조
  // (인물별로 좁혀 보기는 위 검색창으로)
  let sel = null;
  const mine = e => !!sel && e.people.some(v => v.p.id === sel.id);

  // 날짜 | 결과 표지 + 결과 · 사건 · 인물 · 재판부
  const card = e => {
    const k = kind(e.text, e.upcoming);
    const dd = e.upcoming ? dday(e.date) : '';
    return `
    <article class="tl-item ${mine(e) ? 'is-mine' : ''}">
      <div class="tl-item__when">
        <time datetime="${esc(e.ymd.replaceAll('.', '-'))}">${esc(e.ymd.slice(5))}</time>
        <span>${WEEK[e.date.getDay()]}요일</span>
        ${dd ? `<span class="tl-dday">${dd}</span>` : ''}
      </div>
      <div class="tl-item__body">
        <p class="tl-item__result">${k === 'upcoming' ? '' : `<span class="kind kind--${k}">${kindLabel(k, e.text)}</span>`}${esc(e.text)}</p>
        <p class="tl-item__meta">${esc(e.stage)} · ${esc(e.label)} · ${esc(e.agency)}${e.court ? ` · ${esc(e.court)}` : ''}</p>
        <div class="tl-item__people">${e.people.map(v => `<button class="pill pill--person ${sel?.id === v.p.id ? 'is-me' : ''}" data-id="${esc(v.p.id)}" data-case-link="${esc(v.caseId)}">${avatar(v.p, 'ava--sm')}${esc(v.p.name)}</button>`).join('')}</div>
      </div>
    </article>`;
  };

  // 월별로 묶어 머리글(고정)을 붙임
  function byMonth(events) {
    const months = new Map();
    events.forEach(e => {
      const m = e.ymd.slice(0, 4) + '년 ' + Number(e.ymd.slice(5, 7)) + '월';
      if (!months.has(m)) months.set(m, []);
      months.get(m).push(e);
    });
    return [...months].map(([m, list]) =>
      `<h4 class="tl-month">${esc(m)}<small>${list.length}건</small></h4>${list.map(card).join('')}`).join('');
  }

  // 보기: 달력(기본) · 목록. 달력은 한 달씩, 날짜를 누르면 그날 일정만 아래에 모아 봄
  const cal = { mode: 'cal', month: null, day: null, selId: null };
  const monthName = ym => `${ym.slice(0, 4)}년 ${Number(ym.slice(5, 7))}월`;
  let lastEvents = [];

  function pickMonth(events, months) {
    const now = todaySeoul().slice(0, 7);
    const my = sel ? events.filter(mine) : [];
    if (my.length) { // 선택한 인물: 다가오는 첫 일정, 없으면 가장 최근 일정이 있는 달
      const up = my.filter(e => e.upcoming).sort((a, b) => a.date - b.date)[0];
      return (up || my.sort((a, b) => b.date - a.date)[0]).ymd.slice(0, 7);
    }
    return months.includes(now) ? now : (months.find(m => m >= now) || months[months.length - 1] || now);
  }

  function calendarHtml(events) {
    const months = [...new Set(events.map(e => e.ymd.slice(0, 7)))].sort();
    if ((sel?.id || null) !== cal.selId) { cal.selId = sel?.id || null; cal.month = null; cal.day = null; }
    if (!cal.month) cal.month = pickMonth(events, months);
    const today = todaySeoul();
    const [y, m] = cal.month.split('.').map(Number);
    const lead = new Date(y, m - 1, 1).getDay(), days = new Date(y, m, 0).getDate();
    const byDay = new Map();
    events.filter(e => e.ymd.startsWith(cal.month)).forEach(e => { if (!byDay.has(e.ymd)) byDay.set(e.ymd, []); byDay.get(e.ymd).push(e); });
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<span class="cal-cell is-blank" aria-hidden="true"></span>');
    for (let d = 1; d <= days; d++) {
      const ymd = `${cal.month}.${String(d).padStart(2, '0')}`;
      const list = (byDay.get(ymd) || []).sort((a, b) => mine(b) - mine(a) || b.people.length - a.people.length);
      const wd = (lead + d - 1) % 7;
      const evs = list.slice(0, 2).map(e => { const k = kind(e.text, e.upcoming);
        return `<span class="cal-ev cal-ev--${k} ${mine(e) ? 'is-mine' : ''}"><b>${esc(e.people[0].p.name)}${e.people.length > 1 ? ` 외 ${e.people.length - 1}` : ''}</b> ${esc(e.text)}</span>`; }).join('');
      const dots = list.slice(0, 4).map(e => `<i class="cal-dot cal-dot--${kind(e.text, e.upcoming)}"></i>`).join('');
      cells.push(`<button class="cal-cell ${list.length ? 'has-ev' : ''} ${list.some(mine) ? 'is-mine' : ''} ${ymd === today ? 'is-today' : ''} ${ymd === cal.day ? 'is-active' : ''} ${wd === 0 ? 'is-sun' : ''}"
        data-tl-day="${ymd}" ${list.length ? '' : 'disabled'} aria-pressed="${ymd === cal.day}" aria-label="${m}월 ${d}일 ${list.length ? `재판 일정 ${list.length}건` : '일정 없음'}">
        <span class="cal-d">${d}</span><span class="cal-evs">${evs}${list.length > 2 ? `<span class="cal-more">+${list.length - 2}건</span>` : ''}</span><span class="cal-dots" aria-hidden="true">${dots}</span></button>`);
    }
    const i = months.indexOf(cal.month);
    const prev = i > 0 ? months[i - 1] : months.filter(x => x < cal.month).pop();
    const next = i >= 0 ? months[i + 1] : months.find(x => x > cal.month);
    const dayOn = cal.day && cal.day.startsWith(cal.month);
    const shown = dayOn ? (byDay.get(cal.day) || []) : [...byDay.values()].flat().sort((a, b) => a.date - b.date);
    const years = [...new Set(months.map(x => x.slice(0, 4)))];
    return `
      <div class="cal-nav">
        <button class="icon-btn" data-tl-month="${prev || ''}" ${prev ? '' : 'disabled'} aria-label="이전 일정이 있는 달">‹</button>
        <h3 class="cal-nav__title">${monthName(cal.month)}</h3>
        <button class="icon-btn" data-tl-month="${next || ''}" ${next ? '' : 'disabled'} aria-label="다음 일정이 있는 달">›</button>
        <button class="btn btn--secondary btn--sm cal-nav__today" data-tl-month="${today.slice(0, 7)}">오늘</button>
      </div>
      <div class="cal-months chips" aria-label="일정이 있는 달">${years.map(yr => `<span class="cal-year">${yr}</span>${months.filter(x => x.startsWith(yr)).map(x =>
        `<button data-tl-month="${x}" class="${x === cal.month ? 'is-active' : ''}">${Number(x.slice(5))}월</button>`).join('')}`).join('')}</div>
      <div class="cal-grid" role="group" aria-label="${monthName(cal.month)} 달력">${[...WEEK].map((w, k) => `<span class="cal-wd ${k === 0 ? 'is-sun' : ''}">${w}</span>`).join('')}${cells.join('')}</div>
      <p class="cal-legend"><span class="kind kind--guilty">유죄</span><span class="kind kind--acquit">무죄·공소기각</span><span class="kind kind--final">확정</span><span class="kind kind--upcoming">예정</span></p>
      <h3 class="section-title tl-section cal-day-head" id="tl-day">${dayOn ? `${Number(cal.day.slice(5, 7))}월 ${Number(cal.day.slice(8))}일` : `${Number(cal.month.slice(5))}월 전체`}<small>${shown.length}건${dayOn ? ' · <button class="link-btn" data-tl-day="">이 달 전체 보기</button>' : ''}</small></h3>
      ${shown.map(card).join('') || '<p class="empty">이 달에는 기록된 재판 일정이 없습니다.</p>'}`;
  }

  function listHtml(events) {
    const upcoming = events.filter(e => e.upcoming).sort((a, b) => a.date - b.date);
    const past = events.filter(e => !e.upcoming).sort((a, b) => b.date - a.date);
    return `
      <div class="tl-summary">
        ${upcoming.length ? `<button data-tl-jump="upcoming">다가오는 일정<b>${upcoming.length}</b></button>` : ''}
        <button data-tl-jump="past">지난 재판 기록<b>${past.length}</b></button>
        <button data-tl-jump="night">시작점 · 2024.12.3 밤</button>
      </div>
      ${upcoming.length ? `<h3 class="section-title tl-section" id="tl-upcoming">다가오는 일정<small>가까운 날짜순</small></h3>${byMonth(upcoming)}` : ''}
      <h3 class="section-title tl-section" id="tl-past">지난 재판 기록<small>최근 날짜순</small></h3>
      ${past.length ? byMonth(past) : '<p class="empty">이 조건에 해당하는 선고 기록이 없습니다.</p>'}`;
  }

  function paint() {
    const pane = $('#timelinePane');
    pane.innerHTML = `
      <div class="tl-modes"><nav class="segmented segmented--sm" aria-label="타임라인 보기">
        <button data-tl-mode="cal" class="${cal.mode === 'cal' ? 'is-active' : ''}" aria-pressed="${cal.mode === 'cal'}">달력</button>
        <button data-tl-mode="list" class="${cal.mode === 'list' ? 'is-active' : ''}" aria-pressed="${cal.mode === 'list'}">목록</button></nav></div>
      ${cal.mode === 'cal' ? calendarHtml(lastEvents) : listHtml(lastEvents)}
      <details class="tl-night" id="tl-night"><summary>시작점 · 2024년 12월 3일 밤</summary>
        <ol>${NIGHT.map(([t, d]) => `<li><time>${esc(t)}</time>${esc(d)}</li>`).join('')}</ol>
      </details>`;
    // 모바일: 달 칩 줄이 가로로 넘치면 고른 달이 보이게 (그 줄 안에서만)
    const row = $('.cal-months', pane), on = row && $('.is-active', row);
    if (on && row.scrollWidth > row.clientWidth) row.scrollLeft = on.offsetLeft - row.offsetLeft - row.clientWidth / 2 + on.offsetWidth / 2;
  }

  function render(list, agency, selected = null) {
    sel = selected;
    const pane = $('#timelinePane');
    if (pane.hidden) return;
    lastEvents = collect(list, agency);
    shownCount = lastEvents.length;
    paint();
  }

  // 달력 조작: 다시 그려도 타임라인 영역의 스크롤 위치가 튀지 않게
  $('#timelinePane').addEventListener('click', e => {
    const t = e.target.closest('[data-tl-mode],[data-tl-month],[data-tl-day]');
    if (!t || t.disabled) return;
    const pane = $('#timelinePane'), keep = pane.scrollTop;
    if (t.dataset.tlMode) { cal.mode = t.dataset.tlMode; }
    if (t.dataset.tlMonth) { cal.month = t.dataset.tlMonth; cal.day = null; }
    const pickedDay = t.hasAttribute('data-tl-day');
    if (pickedDay) cal.day = t.dataset.tlDay && t.dataset.tlDay !== cal.day ? t.dataset.tlDay : null; // 같은 날 두 번 → 해제
    paint();
    pane.scrollTop = t.dataset.tlMode ? 0 : keep;
    if (pickedDay && cal.day) { // 고른 날의 일정이 보이도록 영역 안에서만 이동
      const h = $('#tl-day', pane);
      pane.scrollTo({ top: h.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop - 8, behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  });

  $('#timelinePane').addEventListener('click', e => {
    const b = e.target.closest('[data-tl-jump]');
    if (!b) return;
    const t = $('#tl-' + b.dataset.tlJump);
    if (t.tagName === 'DETAILS') t.open = true;
    const pane = $('#timelinePane'); // 타임라인 영역 안에서만 스크롤
    pane.scrollTo({ top: t.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop - 8, behavior: reducedMotion() ? 'auto' : 'smooth' });
  });

  // 지금 타임라인에 보이는 일정 수 (카드 제목 배지용)
  let shownCount = 0;
  return { render, count: () => shownCount };
})();
