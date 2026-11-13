// Timeline view: built only from dated court stages already in reader-data.js.
// Defendants sentenced together (same date, court and case group) share one entry.
const NIGHT_OF_DEC3 = [
  ['22:27', '윤석열 대통령, 비상계엄 선포'],
  ['23:00', '계엄사령부 포고령 1호 발령'],
  ['12.4 01:01', '국회, 재석 190명 전원 찬성으로 계엄 해제 요구 결의안 가결'],
  ['12.4 04:27', '윤석열 대통령, 계엄 해제 담화'],
  ['12.4 04:30', '국무회의에서 계엄 해제 의결'],
];
function timelineStageName(record, i) {
  return i === 2 ? '대법원' : (i + 1) + '심';
}
function timelineKind(text, upcoming) {
  if (upcoming) return 'upcoming';
  if (/무죄|공소기각/.test(text)) return 'acquit';
  if (/확정/.test(text)) return 'final';
  if (/징역|벌금|유죄|무기|사형/.test(text)) return 'guilty';
  return 'other';
}
function timelineEvents(list) {
  const today = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).replaceAll('-', '.');
  const groups = new Map();
  for (const p of list) for (const r of p.records || []) {
    if (filter !== 'all' && r.agency !== filter) continue;
    (r.stages || []).forEach((s, i) => {
      const m = String(s[2] || '').match(/(\d{4})\.(\d{2})\.(\d{2})/);
      if (!m) return;
      const date = new Date(+m[1], +m[2] - 1, +m[3]);
      const planned = /예정/.test(s[2]) || /예정/.test(s[0]) || m[0] > today;
      if (/보도|제출|배당/.test(s[2]) && !planned) return; // report or filing dates are not court decisions
      const key = [m[0], s[1], r.family || r.id, s[0]].join('|');
      if (!groups.has(key)) groups.set(key, {date, ymd: m[0], text: s[0], court: s[1], stage: timelineStageName(r, i),
        label: r.label, agency: r.agency, upcoming: planned, people: [], caseId: r.id});
      const g = groups.get(key);
      if (!g.people.some(v => v.p.id === p.id)) g.people.push({p, caseId: r.id});
    });
  }
  return [...groups.values()];
}
// 보기 상태: 달력(기본) 또는 목록. 달력은 한 달씩, 일정이 있는 달로 바로 이동할 수 있다.
const tlState = {mode: 'cal', month: null, day: null};
const tlKstToday = () => new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date()).replaceAll('-', '.');
function tlCard(e) {
  return `<article class="tl-event ${timelineKind(e.text, e.upcoming)}">
      <time>${esc(e.ymd)}</time>
      <div><p class="tl-meta"><span>${esc(e.agency)}</span>${esc(e.stage)} · ${esc(e.label)}</p>
      <b>${esc(e.text)}</b>
      <p class="tl-people">${e.people.map(v => `<button data-id="${esc(v.p.id)}" data-case-link="${esc(v.caseId)}">${esc(v.p.name)}</button>`).join('')}</p>
      ${e.court ? `<small>${esc(e.court)}</small>` : ''}</div></article>`;
}
function tlListHtml(events) {
  const upcoming = events.filter(e => e.upcoming).sort((a, b) => a.date - b.date);
  const past = events.filter(e => !e.upcoming).sort((a, b) => b.date - a.date);
  let lastMonth = '';
  const pastHtml = past.map(e => {
    const month = e.ymd.slice(0, 7).replace('.', '년 ') + '월';
    const head = month !== lastMonth ? `<h4 class="tl-month">${esc(month)}</h4>` : '';
    lastMonth = month;
    return head + tlCard(e);
  }).join('');
  return `${upcoming.length ? `<h3 class="tl-section">다가오는 일정 <small>${upcoming.length}건</small></h3>${upcoming.map(tlCard).join('')}` : ''}
    <h3 class="tl-section">지난 재판 기록 <small>${past.length}건</small></h3>
    ${pastHtml || '<p class="empty">이 조건에 해당하는 선고 기록이 없습니다.</p>'}`;
}
function tlCalendarHtml(events) {
  const today = tlKstToday();
  const months = [...new Set(events.map(e => e.ymd.slice(0, 7)))].sort();
  if (!tlState.month) tlState.month = months.includes(today.slice(0, 7)) ? today.slice(0, 7) : (months.find(m => m >= today.slice(0, 7)) || months[months.length - 1] || today.slice(0, 7));
  const [y, m] = tlState.month.split('.').map(Number);
  const first = new Date(y, m - 1, 1), days = new Date(y, m, 0).getDate(), lead = first.getDay();
  const byDay = new Map();
  events.filter(e => e.ymd.startsWith(tlState.month)).forEach(e => { (byDay.get(e.ymd) || byDay.set(e.ymd, []).get(e.ymd)).push(e); });
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<div class="cal-cell blank" aria-hidden="true"></div>');
  for (let d = 1; d <= days; d++) {
    const ymd = `${tlState.month}.${String(d).padStart(2, '0')}`, list = (byDay.get(ymd) || []).sort((a, b) => b.people.length - a.people.length);
    const chips = list.slice(0, 3).map(e => `<span class="cal-ev ${timelineKind(e.text, e.upcoming)}"><b>${esc(e.people[0].p.name)}${e.people.length > 1 ? ` 외 ${e.people.length - 1}` : ''}</b> ${esc(e.text)}</span>`).join('');
    cells.push(`<button class="cal-cell ${list.length ? 'has' : ''} ${ymd === today ? 'today' : ''} ${ymd === tlState.day ? 'on' : ''} ${(lead + d - 1) % 7 === 0 ? 'sun' : ''}" data-tl-day="${ymd}" ${list.length ? '' : 'tabindex="-1"'} aria-label="${m}월 ${d}일 ${list.length ? `재판 일정 ${list.length}건` : '일정 없음'}">
      <span class="cal-d">${d}</span>${chips}${list.length > 3 ? `<span class="cal-more">+${list.length - 3}건</span>` : ''}</button>`);
  }
  const idx = months.indexOf(tlState.month);
  const prev = idx > 0 ? months[idx - 1] : months.filter(x => x < tlState.month).pop();
  const next = idx >= 0 ? months[idx + 1] : months.find(x => x > tlState.month);
  const dayList = tlState.day && tlState.day.startsWith(tlState.month) ? (byDay.get(tlState.day) || []) : [...byDay.values()].flat().sort((a, b) => a.date - b.date);
  const years = [...new Set(months.map(x => x.slice(0, 4)))];
  return `<div class="cal-nav">
      <button class="cal-step" data-tl-month="${prev || ''}" ${prev ? '' : 'disabled'} aria-label="이전 일정이 있는 달">‹</button>
      <h3>${y}년 ${m}월</h3>
      <button class="cal-step" data-tl-month="${next || ''}" ${next ? '' : 'disabled'} aria-label="다음 일정이 있는 달">›</button>
      <button class="cal-today" data-tl-month="${today.slice(0, 7)}">오늘</button>
    </div>
    <div class="cal-months" aria-label="일정이 있는 달">${years.map(yr => `<span class="cal-year">${yr}</span>${months.filter(x => x.startsWith(yr)).map(x => `<button data-tl-month="${x}" class="${x === tlState.month ? 'on' : ''}">${Number(x.slice(5))}월</button>`).join('')}`).join('')}</div>
    <div class="cal-grid" role="grid">${['일', '월', '화', '수', '목', '금', '토'].map((w, i) => `<span class="cal-wd ${i === 0 ? 'sun' : ''}">${w}</span>`).join('')}${cells.join('')}</div>
    <p class="cal-legend"><span class="guilty">유죄</span><span class="acquit">무죄·공소기각</span><span class="final">확정</span><span class="upcoming">예정</span></p>
    <h3 class="tl-section tl-day-head">${tlState.day && tlState.day.startsWith(tlState.month) ? `${Number(tlState.day.slice(5, 7))}월 ${Number(tlState.day.slice(8))}일` : `${m}월 전체`} <small>${dayList.length}건</small>${tlState.day ? ' <button class="link-button" data-tl-day="">이 달 전체 보기</button>' : ''}</h3>
    ${dayList.map(tlCard).join('') || '<p class="empty">이 달에는 기록된 재판 일정이 없습니다.</p>'}`;
}
function renderTimeline() {
  const el = document.getElementById('timeline');
  if (!el || el.hidden) return;
  const events = timelineEvents(match());
  el.innerHTML = `
    <div class="tl-top"><p class="tl-intro">선고·확정·결심·예정 일정을 모았습니다. 함께 선고된 피고인은 한 번에 묶었고, 이름을 누르면 해당 재판을 엽니다.</p>
      <div class="tl-modes" role="tablist"><button role="tab" data-tl-mode="cal" aria-selected="${tlState.mode === 'cal'}">달력</button><button role="tab" data-tl-mode="list" aria-selected="${tlState.mode === 'list'}">목록</button></div></div>
    ${tlState.mode === 'cal' ? tlCalendarHtml(events) : tlListHtml(events)}
    <details class="tl-night"><summary>시작점 · 2024년 12월 3일 밤</summary>
      <ol>${NIGHT_OF_DEC3.map(([t, d]) => `<li><time>${esc(t)}</time>${esc(d)}</li>`).join('')}</ol>
    </details>`;
}
document.addEventListener('click', e => {
  const t = e.target.closest('#timeline [data-tl-mode],#timeline [data-tl-month],#timeline [data-tl-day]');
  if (!t) return;
  if (t.dataset.tlMode) tlState.mode = t.dataset.tlMode;
  if (t.dataset.tlMonth) { tlState.month = t.dataset.tlMonth; tlState.day = null; }
  if (t.hasAttribute('data-tl-day')) tlState.day = t.dataset.tlDay && t.dataset.tlDay !== tlState.day ? t.dataset.tlDay : null;
  // 다시 그려도 화면이 튀지 않게: 날짜를 고르면 아래 상세로, 달을 바꾸면 달력 머리로 부드럽게 이동
  const pickedDay = t.hasAttribute('data-tl-day') && tlState.day, changedMonth = !!t.dataset.tlMonth;
  const keep = window.scrollY;
  renderTimeline();
  window.scrollTo(0, keep);
  const el = document.getElementById('timeline');
  const target = pickedDay ? el.querySelector('.tl-day-head') : changedMonth ? el.querySelector('.cal-nav') : null;
  if (target) requestAnimationFrame(() => target.scrollIntoView({block: pickedDay ? 'start' : 'nearest', behavior: 'smooth'}));
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-case-link]');
  if (b) { e.stopPropagation(); if ($('#comparison').open) $('#comparison').close(); go(b.dataset.id, b.dataset.caseLink); }
}, true);

