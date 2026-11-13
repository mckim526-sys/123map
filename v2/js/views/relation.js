// 인물 사이 연결 팝업 (선 또는 '연결된 인물' 칩에서 열림)
const Relation = (() => {
  const pop = $('#relationPop');
  let st = null, closeTimer, quietFocus = false;
  let ctx = { agency: () => 'all', open: () => {} };

  function close(restoreFocus = false) {
    clearTimeout(closeTimer);
    const anchor = st?.anchor;
    pop.hidden = true; st = null;
    $$('.is-previewing').forEach(el => { el.classList.remove('is-previewing'); el.removeAttribute('aria-expanded'); });
    if (restoreFocus && anchor?.isConnected) { quietFocus = true; anchor.focus(); quietFocus = false; }
  }

  // 연결을 이루는 재판의 피고인 전원 (선 양 끝 두 사람만이 아니라)
  function roster(entry) {
    if (!entry?.records?.length) return [];
    const seed = entry.records.find(v => v.record.family || (v.record.members || []).length > 1) || entry.records[0];
    const ids = Model.trialmates(seed.person, seed.record); ids.add(seed.person.id);
    const out = [...entry.records];
    for (const id of ids) {
      if (out.some(v => v.person.id === id)) continue;
      const q = Model.get(id), s = seed.record;
      const rec = q.records.find(r => (s.family && r.family === s.family) || (r.members || []).includes(seed.person.id))
        || q.records.find(r => r.label === s.label);
      if (rec) out.push({ person: q, record: rec });
    }
    return out;
  }

  function render() {
    const { a, b, cases, index } = st;
    const entry = cases[index], label = Model.linkLabel(a, b, ctx.agency());
    const team = roster(entry), group = team.length > 2;
    const articles = [...new Map(team.flatMap(v => v.record.news || [])
      .filter(n => /^https:\/\/imnews\.imbc\.com\//.test(n.url)).map(n => [n.url, n])).values()].slice(0, 2);

    const picker = cases.length > 1
      ? `<label class="field"><span class="field-label">연결된 사건 ${cases.length}건</span>
           <select class="select" id="rpCase">${cases.map((c, i) =>
             `<option value="${i}" ${i === index ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}</select></label>`
      : `<div class="field"><span class="field-label">연결된 사건</span><p class="rp-case">${esc(entry?.title || label)}</p></div>`;

    const lastVerdict = r => (r.stages || []).filter(s => s && s[0] && !/미확인|미도달/.test(s[0])).map(s => s[0]).pop() || r.status || '확인 중';

    const bodyHtml = group
      ? `<h3 class="section-title">함께 재판받는 피고인<small>${team.length}명</small></h3>
         <p class="caption">이름을 누르면 그 사람의 재판 상세로 이동합니다. 상소 여부가 사람마다 달라 진행 단계는 각자 표시합니다.</p>
         <ol class="rp-roster">${team.map(({ person, record }) => `
           <li class="${person.id === a.id || person.id === b.id ? 'is-pair' : ''}">
             <div class="rp-roster__head">
               <button class="link-strong" data-open-person="${esc(person.id)}" data-open-case="${esc(record.id)}">${esc(person.name)}</button>
               <span class="caption">${esc(person.role || '')}</span>
               <span class="badge badge--neutral">${esc(lastVerdict(record))}</span>
             </div>
             <p>${esc(record.charges?.[0]?.act || record.title || '')}</p>
           </li>`).join('')}</ol>`
      : `<h3 class="section-title">당시 상황 · 기소 내용</h3>${entry ? entry.records.map(({ person, record }) => `
           <section class="rp-account">
             <p class="eyebrow">${esc(person.name)}의 사건 기록</p>
             <p class="rp-account__title">${esc(record.title)}</p>
             ${(record.charges || []).slice(0, 3).map(c => `<p>${esc(c.act)}</p>`).join('') || '<p>당시 상황에 대한 구체적인 설명을 확인 중입니다.</p>'}
             ${Progress.html(record)}
             <span class="badge badge--neutral">${esc(record.status || '확인 중')}</span>
           </section>`).join('') : '<p class="caption">연결 관계는 기록되어 있지만, 당시 상황을 설명할 사건 자료는 확인 중입니다.</p>'}`;

    pop.innerHTML = `
      <header class="rp-head">
        ${portrait(b, 'rp-photo')}
        <div class="rp-head__text">
          <p class="eyebrow">인물 사이의 연결</p>
          <h2 id="relationTitle">${esc(a.name)} · ${esc(b.name)}</h2>
          <p class="caption">${esc(label)}</p>
        </div>
        <button class="icon-btn rp-close" aria-label="연결 설명 닫기">×</button>
      </header>
      <div class="rp-body">
        ${picker}
        ${bodyHtml}
        ${articles.length ? `<h3 class="section-title">관련 보도</h3><div class="stack">${articles.map(n => `<a class="news-card" href="${esc(n.url)}" target="_blank" rel="noopener noreferrer"><span class="news-card__meta">MBC · ${esc(n.date)}</span><b class="news-card__title">${esc(n.title)}</b></a>`).join('')}</div>` : ''}
        <p class="caption rp-caution">기소 내용은 법원이 인정한 사실과 다를 수 있습니다. 연결선은 공모나 유죄를 뜻하지 않습니다.</p>
      </div>
      <footer class="rp-foot"><button class="btn btn--primary btn--block" data-open-person="${esc(b.id)}">${esc(b.name)} 재판 보기</button></footer>`;
    place();
  }

  function place() {
    if (!st) return;
    if (isMobile()) { pop.style.left = '12px'; pop.style.top = 'auto'; return; }
    const gap = 12, r = st.anchor.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    let left = r.right + gap;
    if (left + w > innerWidth - gap) left = r.left - w - gap;
    pop.style.left = Math.max(gap, Math.min(left, innerWidth - w - gap)) + 'px';
    pop.style.top = Math.max(gap, Math.min(r.top - 16, innerHeight - h - gap)) + 'px';
  }

  function open(aId, bId, anchor, pinned = false) {
    const a = Model.get(aId), b = Model.get(bId), label = Model.linkLabel(a, b, ctx.agency());
    if (!label || a.id === b.id) return;
    clearTimeout(closeTimer);
    if (st?.pinned && !pinned) return;
    if (st?.anchor === anchor) {
      if (pinned) { st.pinned = true; $('.rp-close', pop).focus(); }
      return;
    }
    close();
    st = { a, b, anchor, pinned, cases: Model.sharedCases(a, b, label), index: 0 };
    anchor.classList.add('is-previewing'); anchor.setAttribute('aria-expanded', 'true');
    pop.hidden = false; render();
    if (pinned) $('.rp-close', pop).focus();
  }

  const chipTarget = el => {
    const chip = el.closest('[data-related-to]');
    return chip ? { a: chip.dataset.relatedTo, b: chip.dataset.id, anchor: chip } : null;
  };

  // ── 이벤트 ──
  document.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const t = chipTarget(e.target);
    if (t) open(t.a, t.b, t.anchor);
  });
  document.addEventListener('pointerout', e => {
    if (!st || st.pinned || e.pointerType !== 'mouse') return;
    const next = e.relatedTarget;
    if (next && (pop.contains(next) || st.anchor.contains(next))) return;
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => close(), 200);
  });
  pop.addEventListener('pointerover', () => clearTimeout(closeTimer));
  document.addEventListener('pointerdown', e => {
    if (st && !pop.contains(e.target) && !st.anchor.contains(e.target)) close();
  });
  document.addEventListener('focusin', e => {
    if (quietFocus) return;
    const t = chipTarget(e.target);
    if (t) open(t.a, t.b, t.anchor);
  });
  pop.addEventListener('change', e => {
    if (e.target.id !== 'rpCase') return;
    st.index = +e.target.value; render(); $('#rpCase', pop).focus();
  });
  pop.addEventListener('click', e => {
    if (e.target.closest('.rp-close')) return close(true);
    const btn = e.target.closest('[data-open-person]');
    if (btn) { close(); ctx.open(btn.dataset.openPerson, btn.dataset.openCase); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && st) { e.preventDefault(); e.stopImmediatePropagation(); close(true); }
  }, true);
  addEventListener('resize', () => close());

  return { open, close, chipTarget, setContext: c => Object.assign(ctx, c) };
})();
