// First screen: two large portraits. Pointing at (or tapping) a portrait lists that person's cases
// beside it; choosing a case shows every defendant in that trial and where each one stands.
(function () {
  const host = document.getElementById('landing');
  if (!host) return;
  const FIGURES = ['yoon', 'keon'];
  const done = s => s && s[0] && !/미확인|미도달|판단 전|대기|진행 중|확인 중/.test(s[0]);
  const stageName = i => (i === 2 ? '3심' : (i + 1) + '심');
  function latest(r) {
    const st = r.stages || [];
    const planned = st.map((s, i) => [s, i]).find(([s]) => /예정/.test((s[2] || '') + (s[0] || '')));
    if (planned) return {text: `${stageName(planned[1])} ${planned[0][0]}`, date: planned[0][2] || '', next: true};
    const last = st.map((s, i) => [s, i]).filter(([s]) => done(s)).pop();
    if (last) return {text: `${stageName(last[1])} ${last[0][0]}`, date: last[0][2] || '', next: false};
    return {text: r.status || '진행 상황 확인 중', date: '', next: false};
  }
  function roster(p, r) {
    const ids = typeof casePeople === 'function' ? casePeople(p, r) : new Set();
    const list = [{person: p, record: r}];
    for (const id of ids) {
      const q = lookup(id);
      const rec = q.records.find(x => (r.family && x.family === r.family) || (x.members || []).includes(p.id)) || q.records.find(x => x.label === r.label);
      if (rec) list.push({person: q, record: rec});
    }
    return list;
  }
  const figures = FIGURES.map(lookup).filter(Boolean);
  host.innerHTML = `
    <div class="landing-head"><p class="eyebrow">12·3 내란 재판 기록</p><h2>두 사람의 사건에서 시작하세요</h2>
      <p>사진에 마우스를 올리거나 누르면 사건 목록이 나옵니다. 사건을 고르면 함께 재판받는 피고인과 진행 상황을 보여 줍니다.</p></div>
    <div class="landing-stage">${figures.map((p, i) => `
      <div class="figure ${i ? 'right' : 'left'}" data-figure="${esc(p.id)}">
        <button class="figure-photo" aria-expanded="false" aria-controls="cases-${esc(p.id)}">
          ${img(p, 'figure-img')}
          <span class="figure-name"><b>${esc(p.name)}</b><small>${esc(p.role)}</small></span>
          <span class="figure-count">사건 ${p.records.length}건</span>
        </button>
        <div class="figure-cases" id="cases-${esc(p.id)}">
          <p class="figure-hint">사진에 마우스를 올리면<br>사건 목록이 여기 나옵니다</p>
          <ol>${p.records.map(r => { const l = latest(r); const n = roster(p, r).length; return `
            <li><button data-landing-person="${esc(p.id)}" data-landing-case="${esc(r.id)}">
              <b>${esc(r.label)}${n > 1 ? `<span class="case-people">${n}명</span>` : ''}</b><span class="case-agency">${esc(r.agency)}</span>
              <span class="case-state ${l.next ? 'next' : ''}">${esc(l.text)}${l.date ? ` · ${esc(l.date)}` : ''}</span>
            </button></li>`; }).join('')}</ol>
        </div>
      </div>`).join('')}</div>
    <div class="landing-trial" id="landingTrial" hidden></div>
    <p class="landing-more"><button class="link-button" data-landing-map>전체 관계도 · 재판 목록 · 타임라인 보기 ↓</button></p>`;
  const open = id => host.querySelectorAll('.figure').forEach(f => {
    const on = f.dataset.figure === id;
    f.classList.toggle('open', on);
    f.querySelector('.figure-photo').setAttribute('aria-expanded', String(on));
  });
  function showTrial(pid, cid) {
    const p = lookup(pid), r = p.records.find(x => x.id === cid); if (!r) return;
    host.querySelectorAll('[data-landing-case]').forEach(b => b.classList.toggle('active', b.dataset.landingCase === cid));
    const list = roster(p, r);
    const panel = document.getElementById('landingTrial');
    panel.innerHTML = `
      <div class="lt-head"><div><p class="eyebrow">${esc(r.agency)} · ${list.length > 1 ? `함께 재판받는 피고인 ${list.length}명` : '단독 재판'}</p><h3>${esc(r.title || r.label)}</h3></div>
        <button class="lt-close" aria-label="닫기">×</button></div>
      ${(r.charges || []).length ? `<section class="indictment"><h4>기소 내용</h4>${r.charges.map(c => `<p><b>${esc(c.name)}</b>${esc(c.act)}</p>`).join('')}</section>` : ''}
      <div class="lt-table" role="table" aria-label="피고인별 진행 상황">
        <div class="lt-row lt-th" role="row"><span role="columnheader">피고인</span><span role="columnheader">1심</span><span role="columnheader">2심</span><span role="columnheader">3심</span></div>
        ${list.map(({person, record}) => `<div class="lt-row" role="row">
          <span role="cell" class="lt-who"><button data-lt-go="${esc(person.id)}" data-lt-case="${esc(record.id)}">${esc(person.name)}</button><small>${esc(person.role || '')}</small></span>
          ${[0, 1, 2].map(i => { const s = (record.stages || [])[i] || []; const planned = /예정/.test((s[2] || '') + (s[0] || '')); return `<span role="cell" class="lt-stage ${done(s) && !planned ? 'done' : ''} ${planned ? 'next' : ''}" data-label="${stageName(i)}"><b>${esc(s[0] || '—')}</b>${s[2] ? `<small>${esc(s[2])}</small>` : ''}</span>`; }).join('')}
        </div>`).join('')}
      </div>
      <p class="lt-actions"><button class="lt-map" data-lt-go="${esc(p.id)}" data-lt-case="${esc(r.id)}">관계도에서 이 재판 보기 ↓</button><span>이름을 누르면 그 사람의 재판 상세로 이동합니다.</span></p>`;
    panel.hidden = false;
    panel.scrollIntoView({block: 'nearest', behavior: 'smooth'});
  }
  const canHover = matchMedia('(hover: hover)').matches;
  host.querySelectorAll('.figure').forEach(f => {
    if (canHover) f.addEventListener('mouseenter', () => open(f.dataset.figure));
  });
  host.addEventListener('click', e => {
    const photo = e.target.closest('.figure-photo');
    if (photo) { const id = photo.closest('.figure').dataset.figure; open(photo.getAttribute('aria-expanded') === 'true' && !canHover ? '' : id); return; }
    const c = e.target.closest('[data-landing-case]');
    if (c) { showTrial(c.dataset.landingPerson, c.dataset.landingCase); return; }
    if (e.target.closest('.lt-close')) { document.getElementById('landingTrial').hidden = true; host.querySelectorAll('[data-landing-case].active').forEach(b => b.classList.remove('active')); return; }
    const g = e.target.closest('[data-lt-go]');
    if (g) { document.querySelector('[data-view="map"]').click(); go(g.dataset.ltGo, g.dataset.ltCase); document.getElementById('trial-map').scrollIntoView({block: 'start', behavior: 'smooth'}); return; }
    if (e.target.closest('[data-landing-map]')) document.getElementById('trial-map').scrollIntoView({block: 'start', behavior: 'smooth'});
  });
  // Keyboard users get the list on focus; taps are handled by the click toggle above.
  host.querySelectorAll('.figure-photo').forEach(b => b.addEventListener('focus', () => { if (b.matches(':focus-visible')) open(b.closest('.figure').dataset.figure); }));
})();
