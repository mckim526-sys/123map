// 시험판 첫 화면: 사진 두 장 → 사건 → 함께 재판받는 사람 → 판결 진행, 한 층씩 아래로 펼친다.
// 데이터는 reader-data.js만 쓴다. 경로(path)는 [인물, 사건, 인물, 사건, …]을 번갈아 담는다.
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const byId = new Map(persons.map(p => [p.id, p]));
  const ROOTS = ['yoon', 'keon'];
  const AGENCY_RANK = {'내란특검': 0, '종합특검': 1, '해병대 특검': 2, '김건희 특검': 3};
  // 편집 순서: 내란의 핵심 사건부터.
  const CASE_RANK = {'yoon-main': 0, 'yoon-drone': 1, 'yoon-obstruction': 2, 'keon-three': 0, 'keon-gifts': 1, 'case108': 2};
  // 첫 화면 큰 사진: 사용 권한 있는 파일을 assets/에 넣고 여기 적으면 교체된다. credit은 사진 아래 표기.
  const FIGURE_PHOTOS = {yoon: null, keon: null}; // 예: {file: 'first-yoon.jpg', credit: 'ⓒ연합뉴스', position: '50% 20%'}
  const bigFace = p => { const o = FIGURE_PHOTOS[p.id]; return o
    ? `<img class="root-img" src="assets/${esc(o.file)}" alt="" style="object-position:${esc(o.position || '50% 25%')}">${o.credit ? `<span class="root-credit">${esc(o.credit)}</span>` : ''}`
    : face(p, 'root-img'); };
  const face = (p, cls) => p.photo
    ? `<img class="${cls}" src="assets/${esc(p.photoFile || p.id + '.jpg')}" alt="" style="object-position:${esc(p.photoPosition || '50% 25%')}">`
    : `<span class="${cls} initials" aria-hidden="true">${esc(p.name.slice(0, 1))}</span>`;
  function trialIds(p, r) {
    const ids = new Set(r.members || []);
    if (r.family) persons.forEach(v => { if (v.records.some(x => x.family === r.family)) ids.add(v.id); });
    ids.add(p.id);
    return [...ids];
  }
  function recordFor(q, p, r) {
    if (q.id === p.id) return r;
    return q.records.find(x => (r.family && x.family === r.family) || (x.members || []).includes(p.id) || (r.members || []).includes(q.id) && x.label === r.label)
      || q.records.find(x => x.label === r.label) || null;
  }
  const sortedCases = p => [...p.records].sort((a, b) =>
    (CASE_RANK[a.id] ?? 9) - (CASE_RANK[b.id] ?? 9) || (AGENCY_RANK[a.agency] ?? 9) - (AGENCY_RANK[b.agency] ?? 9) || trialIds(p, b).length - trialIds(p, a).length);
  const decided = s => s && s[0] && !/미확인|미도달|판단 전|대기|진행 중|확인 중|없음/.test(s[0]);
  const planned = s => s && /예정/.test((s[0] || '') + (s[2] || ''));
  function tone(text) {
    if (/예정/.test(text)) return 'next';
    if (/무죄|공소기각/.test(text)) return 'acquit';
    if (/징역|무기|벌금|사형|유죄|자격정지/.test(text)) return 'guilty';
    return 'muted';
  }
  function lastDecided(r) { const s = (r.stages || []).filter(decided).filter(x => !planned(x)).pop(); return s ? s[0] : ''; }
  function headline(r) {
    const st = r.stages || [];
    const next = st.findIndex(planned);
    const when = s => ((s[2] || '').match(/\d{4}\.\d{2}\.\d{2}/) || [''])[0].slice(2);
    if (next >= 0) return {text: `${next === 2 ? '대법원' : next + 1 + '심'} ${st[next][0]}${when(st[next]) ? ' ' + when(st[next]) : ''}`, tone: 'next'};
    const last = st.map((s, i) => [s, i]).filter(([s]) => decided(s)).pop();
    if (last) return {text: `${last[1] === 2 ? '대법원' : last[1] + 1 + '심'} ${last[0][0]}`, tone: tone(last[0][0])};
    return {text: r.status || '진행 확인 중', tone: 'muted'};
  }

  const root = document.getElementById('first'), rootsBox = document.getElementById('roots');
  let path = [];
  function render(focusLayer) {
    const crumbs = [`<button data-crumb="0">처음</button>`].concat(path.map((id, i) => {
      const label = i % 2 === 0 ? byId.get(id).name : findCase(i).label;
      return `<button data-crumb="${i + 1}" ${i === path.length - 1 ? 'aria-current="step"' : ''}>${esc(label)}</button>`;
    })).join('<span aria-hidden="true">›</span>');
    let html = `<nav class="crumbs" aria-label="현재 위치">${crumbs}</nav>`;
    rootsBox.innerHTML = ROOTS.map(id => { const p = byId.get(id); const on = path[0] === id, off = path.length && !on; return `
      <button class="root ${on ? 'on' : ''} ${off ? 'off' : ''}" data-root="${esc(id)}" aria-pressed="${on}">
        ${bigFace(p)}<span class="root-label"><small>${esc(p.role || '')}</small><b>${esc(p.name)}</b><em>사건 ${p.records.length}건 보기</em></span>
      </button>`; }).join('');
    document.body.classList.toggle('exploring', path.length > 0);
    for (let i = 0; i < path.length; i++) {
      if (i % 2 === 0) {
        const p = byId.get(path[i]), chosen = path[i + 1];
        if (i > 0) html += personLayer(p, findCase(i - 1), i);
        html += `<section class="layer" data-layer="${i}"><h2 class="layer-title"><span>${esc(p.name)}</span>의 사건</h2><ol class="cases">${sortedCases(p).filter(r => !(i > 0 && r.id === recordFor(p, byId.get(path[i - 2]), findCase(i - 1))?.id)).map(r => { const h = headline(r), n = trialIds(p, r).length; return `
          <li><button class="case ${chosen === r.id ? 'on' : ''} ${chosen && chosen !== r.id ? 'off' : ''}" data-case="${esc(r.id)}" data-depth="${i + 1}">
            <b>${esc(r.label)}</b><span class="tone ${h.tone}">${esc(h.text)}</span><small>${esc(r.agency)}${n > 1 ? ` · ${n}명` : ''}</small>
          </button></li>`; }).join('')}</ol></section>`;
      } else {
        const p = byId.get(path[i - 1]), r = findCase(i), chosen = path[i + 1];
        const people = trialIds(p, r).map(id => byId.get(id)).sort((a, b) => (a.id === p.id ? -1 : b.id === p.id ? 1 : 0) || (b.photo ? 1 : 0) - (a.photo ? 1 : 0));
        html += `<section class="layer" data-layer="${i}"><h2 class="layer-title"><span>${esc(r.label)}</span> · ${people.length > 1 ? `함께 재판받는 ${people.length}명` : '단독 재판'}</h2>
          ${(r.charges || []).length ? `<p class="charge">${esc(r.charges.map(c => c.name).join(' · '))}</p>` : ''}
          <ol class="people">${people.map(q => { const rec = recordFor(q, p, r), h = rec ? headline(rec) : {text: '', tone: 'muted'}, d = rec ? lastDecided(rec) : null; return `
            <li><button class="person ${chosen === q.id ? 'on' : ''} ${chosen && chosen !== q.id ? 'off' : ''}" data-person="${esc(q.id)}" data-depth="${i + 1}">
              ${face(q, 'person-img')}<b>${esc(q.name)}</b><small>${esc(q.role || '')}</small>${d ? `<span class="tone ${tone(d)}">${esc(d)}</span>` : ''}${h.tone === 'next' || !d ? `<span class="tone ${h.tone} sub">${esc(h.text)}</span>` : ''}
            </button></li>`; }).join('')}</ol></section>`;
      }
    }
    root.innerHTML = html;
    const target = root.querySelector(`[data-layer="${focusLayer}"]`);
    if (target) target.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    try { history.replaceState(null, '', path.length ? '#' + path.join('/') : location.pathname); } catch {}
  }
  function findCase(i) { return byId.get(path[i - 1]).records.find(r => r.id === path[i]) || {}; }
  function personLayer(q, r, i) {
    const p0 = byId.get(path[i - 2]), rec = recordFor(q, p0, r);
    if (!rec) return `<section class="layer layer-person" data-layer="${i}-p"><p class="charge">${esc(q.name)}의 이 재판 기록은 확인 중입니다.</p></section>`;
    const st = rec.stages || [];
    return `<section class="layer layer-person" data-layer="${i}-p"><div class="verdict-card">
        ${face(q, 'verdict-img')}<div><h2>${esc(q.name)} <small>${esc(q.role || '')}</small></h2><p class="verdict-case">${esc(rec.title || rec.label)}</p>
        ${(rec.charges || []).length ? `<p class="charge">${esc(rec.charges.map(c => c.name).join(' · '))}</p>` : ''}</div></div>
      <ol class="steps">${[0, 1, 2].map(k => { const s = st[k] || []; const t = planned(s) ? 'next' : decided(s) ? tone(s[0]) : 'muted'; return `
        <li class="step ${t}"><span>${k === 2 ? '대법원' : k + 1 + '심'}</span><b>${esc(s[0] || '—')}</b><small>${esc([s[2], s[1]].filter(Boolean).join(' · '))}</small></li>`; }).join('<li class="arrow" aria-hidden="true">→</li>')}</ol>
      <p class="more"><a href="index.html#person/${encodeURIComponent(q.id)}/${encodeURIComponent(rec.id)}">이 재판 자세히 보기 ↗</a></p></section>`;
  }
  [root, rootsBox].forEach(el => el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.root) { path = path[0] === b.dataset.root ? [] : [b.dataset.root]; render(0); return; }
    if (b.dataset.case) { const d = +b.dataset.depth; path = path.slice(0, d); if (path[d] !== b.dataset.case) path[d] = b.dataset.case; render(d); return; }
    if (b.dataset.person) { const d = +b.dataset.depth; path = path.slice(0, d).concat(b.dataset.person); render(`${d}-p`); return; }
    if (b.dataset.crumb) { path = path.slice(0, +b.dataset.crumb); render(path.length - 1); }
  }));
  // 주소의 #yoon/yoon-main/kim 같은 경로를 복원한다 (공유용).
  const start = location.hash.slice(1).split('/').filter(Boolean).map(decodeURIComponent);
  if (start.length && byId.has(start[0])) {
    const ok = [start[0]];
    for (let i = 1; i < start.length; i++) {
      if (i % 2 === 1) { if (byId.get(ok[i - 1]).records.some(r => r.id === start[i])) ok.push(start[i]); else break; }
      else { if (byId.has(start[i])) ok.push(start[i]); else break; }
    }
    path = ok;
  }
  // 첫 화면 숫자: 데이터에서 계산.
  const people = persons.filter(p => p.group !== 'witness');
  const recs = people.flatMap(p => p.records);
  const judged = recs.filter(r => (r.stages || []).some(s => /징역|무죄|벌금|공소기각|무기|집행유예/.test(s[0] || '') && !/구형|예정/.test(s[0] || ''))).length;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const nextDates = recs.flatMap(r => (r.stages || []).map(s => ((s[2] || '').match(/(\d{4})\.(\d{2})\.(\d{2})/) || null)).filter(Boolean))
    .map(m => new Date(+m[1], +m[2] - 1, +m[3])).filter(d => d >= today).sort((a, b) => a - b);
  const stats = document.getElementById('stats');
  if (stats) stats.innerHTML = `<div><b>${people.length}</b><span>기록한 인물</span></div><div><b>${judged}</b><span>판결이 나온 재판</span></div>${nextDates[0] ? `<div><b>${nextDates[0].getMonth() + 1}.${nextDates[0].getDate()}</b><span>다음 재판 일정</span></div>` : ''}`;
  render(path.length - 1);
})();
