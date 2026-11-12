// 보류 중: 3분 요약. 다시 쓰려면 index.html의 지도 섹션 앞에 <section class="brief" id="brief"></section>을, timeline.js 뒤에 <script src="brief.js"></script>를 넣는다.
// "3분 요약": a four-step story above the map for readers who arrive without background.
// Counts and dates are computed from reader-data.js so the summary never drifts from the records.
(function () {
  const host = document.getElementById('brief');
  if (!host) return;
  const people = persons.filter(p => p.group !== 'witness');
  const records = people.flatMap(p => p.records.map(r => ({p, r})));
  const judged = records.filter(({r}) => (r.stages || []).some(s => /징역|무죄|벌금|공소기각|무기|집행유예|사형/.test(s[0] || '') && !/구형/.test(s[0] || '')));
  const final = records.filter(({r}) => /확정/.test(r.status || '') && !/미확인|여부|확인 중/.test(r.status || ''));
  const yoonMain = lookup('yoon').records.find(r => r.id === 'yoon-main');
  const first = yoonMain?.stages?.[0] || [];
  const totals = typeof AGENCY_TOTALS === 'object' ? AGENCY_TOTALS : {};
  const upcoming = typeof timelineEvents === 'function'
    ? timelineEvents(persons).filter(e => e.upcoming).sort((a, b) => a.date - b.date).slice(0, 3) : [];
  const step = (n, title, body, action) => `<article class="brief-step"><span class="brief-no">${n}</span><h3>${title}</h3>${body}${action || ''}</article>`;
  let closed = false;
  try { closed = localStorage.getItem('brief-closed') === '1'; } catch {}
  host.innerHTML = `
    <div class="brief-head"><div><p class="eyebrow">처음 오셨나요?</p><h2>3분 요약 · 12·3 내란, 지금 어디까지 왔나</h2></div>
      <button class="brief-toggle" aria-expanded="${!closed}">${closed ? '요약 펼치기' : '요약 접기'}</button></div>
    <div class="brief-steps" ${closed ? 'hidden' : ''}>
      ${step(1, '그날 밤', `<ol class="brief-night">${NIGHT_OF_DEC3.map(([t, d]) => `<li><time>${esc(t)}</time>${esc(d)}</li>`).join('')}</ol>
        <p class="brief-after">2025년 4월 4일 헌법재판소가 윤석열 대통령을 재판관 전원일치로 파면했습니다.</p>`)}
      ${step(2, '네 갈래의 특검 수사', `<ul class="brief-agencies">${agencies.map(a => `<li><b>${esc(a)}</b><span>${totals[a] ? `기소 ${totals[a][0]}명` : ''}</span></li>`).join('')}</ul>
        <p>특검 출범 전 검찰·군검찰이 기소한 사람과 관련 인물까지 모두 <b>${persons.length}명</b>을 수록했습니다.</p>`,
        `<button class="brief-go" data-brief-filter="내란특검">특검별 관계도 보기 ↓</button>`)}
      ${step(3, '재판은 어디까지', `<p class="brief-big"><b>${judged.length}</b>건 판결 · <b>${final.length}</b>건 확정</p>
        <p>수록한 재판 기록 ${records.length}건 가운데 한 번 이상 판결이 나온 것과 더 다툴 수 없게 확정된 것입니다.</p>
        ${first[0] ? `<p class="brief-key">윤석열 내란 우두머리 혐의 1심 <b>${esc(first[0])}</b> <small>${esc(first[2] || '')}</small></p>` : ''}`,
        `<button class="brief-go" data-brief-home>내란 본류 8명 관계도 ↓</button>`)}
      ${step(4, '다음 일정', upcoming.length ? `<ul class="brief-next">${upcoming.map(e => `<li><time>${esc(e.ymd)}</time><span>${esc(e.people.map(v => v.p.name).slice(0, 4).join('·'))}${e.people.length > 4 ? ` 외 ${e.people.length - 4}명` : ''}</span><small>${esc(e.label)} · ${esc(e.text)}</small></li>`).join('')}</ul>` : '<p>예정된 선고 일정을 확인하고 있습니다.</p>',
        `<button class="brief-go" data-brief-timeline>타임라인 전체 보기 ↓</button>`)}
    </div>
    <p class="brief-foot" ${closed ? 'hidden' : ''}>낯선 법률 용어는 밑줄을 누르면 뜻이 나옵니다 · <button class="link-button" data-open-glossary>용어 풀이 전체</button> · <button class="link-button" data-open-changelog>업데이트 기록</button></p>`;
  const toMap = () => document.querySelector('#trial-map').scrollIntoView({block: 'start', behavior: 'smooth'});
  host.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('.brief-toggle')) {
      const steps = host.querySelector('.brief-steps'), foot = host.querySelector('.brief-foot');
      const nowClosed = !steps.hidden; steps.hidden = nowClosed; foot.hidden = nowClosed;
      t.closest('.brief-toggle').textContent = nowClosed ? '요약 펼치기' : '요약 접기';
      t.closest('.brief-toggle').setAttribute('aria-expanded', String(!nowClosed));
      try { localStorage.setItem('brief-closed', nowClosed ? '1' : '0'); } catch {}
      return;
    }
    const f = t.closest('[data-brief-filter]');
    if (f) { document.querySelector(`[data-view="map"]`).click(); document.querySelector(`[data-filter="${f.dataset.briefFilter}"]`).click(); toMap(); return; }
    if (t.closest('[data-brief-home]')) { document.querySelector(`[data-view="map"]`).click(); document.getElementById('resetMap').click(); toMap(); return; }
    if (t.closest('[data-brief-timeline]')) { document.querySelector(`[data-view="timeline"]`).click(); toMap(); }
  });
})();
