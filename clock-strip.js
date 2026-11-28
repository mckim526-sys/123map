// 처음 화면 미리보기(clock-preview.html)의 '법정의 시간' 띠:
// 2024.12.3 계엄부터 오늘까지(그리고 다가오는 선고까지) 1심·2심·대법원 선고를 눈금으로 찍는다.
// 줄: 윤석열 · 김건희 · 그 밖의 피고인. 눈금을 올리거나 누르면 아래 한 줄에 그날의 선고가 나오고, '재판 보기'로 관계도 상세를 연다.
(function () {
  const box = document.getElementById('strip');
  if (!box || typeof persons === 'undefined') return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const DAY = 86400e3;
  const kst = new Date(Date.now() + 9 * 3600e3);
  const todayStr = kst.toISOString().slice(0, 10), TODAY = Date.parse(todayStr);
  const T0 = Date.parse('2024-12-03');
  const dateOf = s => { const m = String(s || '').match(/(\d{4})\.(\d{2})\.(\d{2})/); return m ? Date.parse(`${m[1]}-${m[2]}-${m[3]}`) : null; };
  const fmt = t => { const d = new Date(t); return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`; };
  const WD = '일월화수목금토', wd = t => WD[new Date(t).getUTCDay()];
  const stageName = i => (i === 2 ? '대법원' : i + 1 + '심');
  // 선고로 보는 결과 / 선고가 아닌 진행 표기
  const VERDICT = /징역|금고|벌금|무죄|공소기각|집행유예|선고유예|무기|사형|면소|자격정지|파기환송|확정|기각|유지/;
  const NOT = /예정|미확인|미도달|판단 전|대기|진행 중|확인 중|없음|중단|취하|제기|배당|접수|공판|준비/;
  const SENTENCE = /징역|금고|벌금|무죄|공소기각|집행유예|선고유예|무기|사형|면소|자격정지|추징/;
  function result(st, i) { // '상고 기각 · 원심 확정'처럼 형량이 없으면 앞 심급 형량으로 '○○ 확정'
    const t = String((st[i] || [])[0] || '');
    if (!/확정/.test(t) || SENTENCE.test(t)) return t;
    for (let j = i - 1; j >= 0; j--) { const p = String((st[j] || [])[0] || ''); if (SENTENCE.test(p) && !/예정|미확인/.test(p)) return `${p} 확정`; }
    return t;
  }

  // ── 사건 모으기: 같은 날·같은 재판(family)·같은 심급은 한 눈금 ──
  const ROWS = [{id: 'yoon', name: '윤석열'}, {id: 'keon', name: '김건희'}, {id: '*', name: '그 밖의 피고인'}];
  const rowOf = p => (p.id === 'yoon' ? 0 : p.id === 'keon' ? 1 : 2);
  const groups = new Map(), events = new Map();
  let finals = 0;
  persons.forEach(p => p.records.forEach(r => {
    const st = r.stages || [];
    if (st.some(s => /확정/.test(s[0] || '') && !/예정|미확인/.test(s[0] || ''))) finals++;
    st.forEach((s, i) => {
      const t = dateOf(s[2]); if (t == null) return;
      const text = String(s[0] || '');
      const done = VERDICT.test(text) && !NOT.test(text) && t <= TODAY && t >= T0;
      const next = /선고 예정/.test(text) && t >= TODAY;
      if (!done && !next) return;
      const fam = r.family || r.id, row = rowOf(p);
      const key = [row, done ? 'd' : 'n', t, fam, i].join('|');
      const g = groups.get(key) || {row, kind: done ? 'done' : 'next', t, i, label: r.label, result: done ? result(st, i) : '선고 예정', time: (String(s[2]).match(/\b\d{1,2}:\d{2}\b/) || [''])[0], people: [], href: ''};
      if (!g.people.some(v => v.id === p.id)) g.people.push({id: p.id, name: p.name, rid: r.id});
      groups.set(key, g);
      events.set([done ? 'd' : 'n', t, fam, i].join('|'), 1); // 줄과 무관하게 선고 횟수 셈
    });
  }));
  const all = [...groups.values()].sort((a, b) => a.t - b.t || (a.time || '99').localeCompare(b.time || '99') || a.row - b.row);
  all.forEach(g => { const lead = g.people.find(v => v.id === 'yoon') || g.people[0]; g.lead = lead; g.href = `#person/${encodeURIComponent(lead.id)}/${encodeURIComponent(lead.rid)}`; });
  const doneN = [...events.keys()].filter(k => k[0] === 'd').length, nextN = [...events.keys()].filter(k => k[0] === 'n').length;
  const lastNext = Math.max(TODAY, ...all.filter(g => g.kind === 'next').map(g => g.t));
  const T1 = Math.max(TODAY + 90 * DAY, lastNext + 30 * DAY);
  const pct = t => ((t - T0) / (T1 - T0) * 100).toFixed(3);
  const others = new Set(); persons.forEach(p => { if (rowOf(p) === 2) others.add(p.id); });

  const H = [10, 16, 22]; // 심급이 높을수록 긴 눈금
  const mark = (g, k) => {
    const who = g.people.length > 1 ? `${g.lead.name} 외 ${g.people.length - 1}명` : g.lead.name;
    const aria = `${fmt(g.t)} ${who} · ${g.label} · ${stageName(g.i)} ${g.result}`;
    return `<button type="button" class="mk mk--${g.kind} mk--s${g.i}" data-k="${k}" style="left:${pct(g.t)}%;--h:${H[g.i]}px" aria-label="${esc(aria)}"></button>`;
  };
  const years = [2025, 2026, 2027, 2028].map(y => Date.parse(`${y}-01-01`)).filter(t => t > T0 && t < T1 && (t - T0) / (T1 - T0) > .1);
  box.innerHTML = `
    <header class="strip__head">
      <h2>법정의 시간</h2>
      <p class="strip__sum"><span>선고 <b>${doneN}</b>번</span><span>형 확정 <b>${finals}</b>건</span><span class="strip__sum-next">앞으로 <b>${nextN}</b>번</span></p>
    </header>
    <div class="strip__grid" role="group" aria-label="2024년 12월 3일부터 다가오는 선고까지, 선고가 있었던 날">
      <div class="strip__labels" aria-hidden="true">${ROWS.map((r, i) => `<span>${i === 2 ? `그 밖의<b class="strip__long"> 피고인</b><small>${others.size}명</small>` : r.name}</span>`).join('')}</div>
      <div class="strip__plot">
        <div class="strip__future" style="left:${pct(TODAY)}%" aria-hidden="true"></div>
        ${ROWS.map((r, ri) => `<div class="strip__track">${all.map((g, k) => g.row === ri ? mark(g, k) : '').join('')}</div>`).join('')}
        <div class="strip__today" style="left:${pct(TODAY)}%" aria-hidden="true"><span>오늘</span></div>
        <div class="strip__axis" aria-hidden="true">
          <span class="strip__tick strip__tick--start" style="left:0">2024.12.3 계엄</span>
          ${years.map(t => `<span class="strip__tick" style="left:${pct(t)}%">${new Date(t).getUTCFullYear()}</span>`).join('')}
        </div>
      </div>
    </div>
    <p class="strip__readout" aria-live="polite"></p>
    <p class="strip__legend" aria-hidden="true"><span class="lg lg--s0"></span>1심<span class="lg lg--s1"></span>2심<span class="lg lg--s2"></span>대법원<span class="lg lg--next"></span>다가오는 선고</p>`;

  const out = box.querySelector('.strip__readout');
  let picked = null;
  function show(k, sticky) {
    const g = all[k]; if (!g) return;
    if (sticky) { box.querySelectorAll('.mk.is-on').forEach(b => b.classList.remove('is-on')); box.querySelector(`.mk[data-k="${k}"]`)?.classList.add('is-on'); picked = k; }
    const who = g.people.length > 1 ? `${esc(g.lead.name)} <em>외 ${g.people.length - 1}명</em>` : esc(g.lead.name);
    const when = `${fmt(g.t)} <small>${wd(g.t)}${g.time ? ' ' + esc(g.time) : ''}</small>`;
    out.innerHTML = `<time>${when}</time><span class="ro__what"><b>${who}</b><span>${esc(g.label)} · ${stageName(g.i)} <strong class="${g.kind === 'next' ? 'is-next' : ''}">${esc(g.result)}</strong></span></span><a class="ro__go" data-enter href="${g.href}">재판 보기 <i aria-hidden="true">→</i></a>`;
  }
  const back = () => { if (picked != null) show(picked, false); };
  box.addEventListener('pointerover', e => { const b = e.target.closest('.mk'); if (b) show(+b.dataset.k, false); });
  box.addEventListener('pointerleave', back);
  box.addEventListener('focusin', e => { const b = e.target.closest('.mk'); if (b) show(+b.dataset.k, true); });
  box.addEventListener('click', e => { const b = e.target.closest('.mk'); if (b) show(+b.dataset.k, true); });
  // 처음엔 가장 가까운 다가오는 선고(없으면 가장 최근 선고)를 보여 줌
  const first = all.findIndex(g => g.kind === 'next');
  show(first >= 0 ? first : all.length - 1, true);
  box.hidden = false;
})();
