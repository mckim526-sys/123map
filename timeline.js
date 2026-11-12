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
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const groups = new Map();
  for (const p of list) for (const r of p.records || []) {
    if (filter !== 'all' && r.agency !== filter) continue;
    (r.stages || []).forEach((s, i) => {
      const m = String(s[2] || '').match(/(\d{4})\.(\d{2})\.(\d{2})/);
      if (!m) return;
      const date = new Date(+m[1], +m[2] - 1, +m[3]);
      const planned = /예정/.test(s[2]) || /예정/.test(s[0]) || date >= today;
      if (/보도|제출/.test(s[2]) && !planned) return; // report or filing dates are not court decisions
      const key = [m[0], s[1], r.family || r.id, s[0]].join('|');
      if (!groups.has(key)) groups.set(key, {date, ymd: m[0], text: s[0], court: s[1], stage: timelineStageName(r, i),
        label: r.label, agency: r.agency, upcoming: planned, people: [], caseId: r.id});
      const g = groups.get(key);
      if (!g.people.some(v => v.p.id === p.id)) g.people.push({p, caseId: r.id});
    });
  }
  return [...groups.values()];
}
function renderTimeline() {
  const el = document.getElementById('timeline');
  if (!el || el.hidden) return;
  const events = timelineEvents(match());
  const upcoming = events.filter(e => e.upcoming).sort((a, b) => a.date - b.date);
  const past = events.filter(e => !e.upcoming).sort((a, b) => b.date - a.date);
  const card = e => `<article class="tl-event ${timelineKind(e.text, e.upcoming)}">
      <time>${esc(e.ymd)}</time>
      <div><p class="tl-meta"><span>${esc(e.agency)}</span>${esc(e.stage)} · ${esc(e.label)}</p>
      <b>${esc(e.text)}</b>
      <p class="tl-people">${e.people.map(v => `<button data-id="${esc(v.p.id)}" data-case-link="${esc(v.caseId)}">${esc(v.p.name)}</button>`).join('')}</p>
      ${e.court ? `<small>${esc(e.court)}</small>` : ''}</div></article>`;
  let lastMonth = '';
  const pastHtml = past.map(e => {
    const month = e.ymd.slice(0, 7).replace('.', '년 ') + '월';
    const head = month !== lastMonth ? `<h4 class="tl-month">${esc(month)}</h4>` : '';
    lastMonth = month;
    return head + card(e);
  }).join('');
  el.innerHTML = `
    <p class="tl-intro">선고·확정·결심·예정 일정을 날짜순으로 모았습니다. 함께 선고된 피고인은 한 줄로 묶었고, 이름을 누르면 해당 재판을 엽니다. 날짜가 기록되지 않은 심급은 빠져 있습니다.</p>
    ${upcoming.length ? `<h3 class="tl-section">다가오는 일정 <small>${upcoming.length}건</small></h3>${upcoming.map(card).join('')}` : ''}
    <h3 class="tl-section">지난 재판 기록 <small>${past.length}건</small></h3>
    ${pastHtml || '<p class="empty">이 조건에 해당하는 선고 기록이 없습니다.</p>'}
    <details class="tl-night"><summary>시작점 · 2024년 12월 3일 밤</summary>
      <ol>${NIGHT_OF_DEC3.map(([t, d]) => `<li><time>${esc(t)}</time>${esc(d)}</li>`).join('')}</ol>
    </details>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-case-link]');
  if (b) { e.stopPropagation(); if ($('#comparison').open) $('#comparison').close(); go(b.dataset.id, b.dataset.caseLink); }
}, true);
