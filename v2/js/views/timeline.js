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

  function render(list, agency, selected = null) {
    sel = selected;
    const pane = $('#timelinePane');
    if (pane.hidden) return;
    const events = collect(list, agency);
    shownCount = events.length;
    const upcoming = events.filter(e => e.upcoming).sort((a, b) => a.date - b.date);
    const past = events.filter(e => !e.upcoming).sort((a, b) => b.date - a.date);
    pane.innerHTML = `
      <div class="tl-summary">
        ${upcoming.length ? `<button data-tl-jump="upcoming">다가오는 일정<b>${upcoming.length}</b></button>` : ''}
        <button data-tl-jump="past">지난 재판 기록<b>${past.length}</b></button>
        <button data-tl-jump="night">시작점 · 2024.12.3 밤</button>
      </div>
      ${upcoming.length ? `<h3 class="section-title tl-section" id="tl-upcoming">다가오는 일정<small>가까운 날짜순</small></h3>${byMonth(upcoming)}` : ''}
      <h3 class="section-title tl-section" id="tl-past">지난 재판 기록<small>최근 날짜순</small></h3>
      ${past.length ? byMonth(past) : '<p class="empty">이 조건에 해당하는 선고 기록이 없습니다.</p>'}
      <details class="tl-night" id="tl-night"><summary>시작점 · 2024년 12월 3일 밤</summary>
        <ol>${NIGHT.map(([t, d]) => `<li><time>${esc(t)}</time>${esc(d)}</li>`).join('')}</ol>
      </details>`;
  }

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
