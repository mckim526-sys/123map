// Plain-language explanations of legal terms. The first time a term appears in a trial card,
// popup or timeline it is underlined; hovering, focusing or tapping it shows the meaning.
const GLOSSARY = [
  ['내란 우두머리', /내란\s?우두머리/, '내란을 주도하고 지휘한 사람에게 적용하는 혐의입니다. 법정형은 사형, 무기징역, 무기금고뿐입니다.'],
  ['내란 중요임무 종사', /내란\s?중요\s?임무\s?종사|중요\s?임무\s?종사/, '내란에서 모의에 참여하거나 지휘 등 중요한 임무를 맡은 사람에게 적용하는 혐의입니다. 우두머리보다는 가볍지만 사형·무기 또는 5년 이상의 징역·금고로 무겁게 처벌합니다.'],
  ['내란 선동', /내란\s?선동/, '내란을 일으키도록 다른 사람을 부추긴 혐의입니다.'],
  ['일반이적', /일반\s?이적/, '대한민국의 군사상 이익을 해치거나 적국에 군사상 이익을 준 혐의입니다. 평양 무인기 사건에 적용됐습니다.'],
  ['직권남용 권리행사방해', /직권\s?남용\s?권리\s?행사\s?방해/, '공무원이 권한을 남용해 다른 사람에게 의무 없는 일을 시키거나 정당한 권리 행사를 막은 혐의입니다.'],
  ['모해위증', /모해\s?위증/, '다른 사람을 형사처벌받게 할 목적으로 법정에서 거짓 증언한 혐의입니다. 일반 위증보다 무겁게 처벌합니다.'],
  ['위증', /위증/, '법정이나 국회에서 선서한 증인이 기억에 반하는 거짓 진술을 한 혐의입니다.'],
  ['특검', /특검/, '특별검사. 국회가 법률로 정해, 기존 검찰과 별도로 독립해서 수사하고 기소하는 검사입니다.'],
  ['구형', /구형/, '재판 마지막에 검사(특검)가 법원에 요청하는 형량입니다. 법원이 내린 형이 아닙니다.'],
  ['결심', /결심/, '증거 조사와 변론을 모두 마치는 재판 절차입니다. 보통 이날 검사가 구형하고 선고 날짜가 정해집니다.'],
  ['선고', /선고/, '법원이 유죄·무죄와 형량을 공개적으로 밝히는 것입니다.'],
  ['공소기각', /공소\s?기각/, '기소 절차에 법적인 문제가 있어 유죄·무죄를 따지지 않고 재판을 끝내는 판결입니다. 무죄와는 다릅니다.'],
  ['파기환송', /파기\s?환송/, '상급 법원이 아래 법원의 판결을 깨고, 다시 재판하라고 돌려보내는 것입니다. 그 자체로 유죄나 무죄가 확정되는 것은 아닙니다.'],
  ['항소', /항소/, '1심 판결에 불복해 2심(고등법원 등)에 다시 재판을 청구하는 것입니다.'],
  ['상고', /상고/, '2심 판결에 불복해 대법원에 판단을 구하는 것입니다.'],
  ['확정', /확정/, '더 이상 상소할 수 없게 되어 판결이 최종 효력을 갖게 된 상태입니다. 상소 기간이 지나거나 대법원 판결이 나오면 확정됩니다.'],
  ['집행유예', /집행\s?유예/, '형을 선고하되 정해진 기간 동안 집행을 미루는 것입니다. 그 기간을 문제없이 지나면 형의 선고는 효력을 잃습니다.'],
  ['법정구속', /법정\s?구속/, '구속되지 않은 상태로 재판받던 피고인을, 선고 직후 법정에서 바로 구속하는 것입니다.'],
  ['구속집행정지', /구속\s?집행\s?정지/, '건강 등 사정이 있을 때 구속된 피고인을 일정 기간 풀어주는 것입니다. 무죄나 석방 확정이 아닙니다.'],
  ['보석', /보석\s?(?:취소|청구|허가|석방|신청|으로|중)/, '보증금 등 조건을 붙여 구속된 피고인을 재판 중에 풀어주는 제도입니다. 조건을 어기면 취소될 수 있습니다.'],
  ['전원합의체', /전원\s?합의체/, '대법원장과 대법관들이 모두 함께 심리하는 대법원 재판부입니다. 중요한 사건이나 기존 판례를 바꿀 때 열립니다.'],
  ['공판준비기일', /공판\s?준비\s?기일|공판준비/, '본격적인 재판에 앞서 쟁점과 증거를 정리하는 절차입니다.'],
  ['추징', /추징/, '범죄로 얻은 돈이나 물건을 몰수할 수 없을 때, 그 값만큼을 거둬들이는 것입니다.'],
];
(function () {
  const tip = document.createElement('div');
  tip.className = 'term-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
  document.body.appendChild(tip);
  const byKey = new Map(GLOSSARY.map(g => [g[0], g]));
  function show(el) {
    const g = byKey.get(el.dataset.term); if (!g) return;
    tip.innerHTML = `<b>${esc(g[0])}</b>${esc(g[2])}`; tip.hidden = false;
    const r = el.getBoundingClientRect(), w = Math.min(300, window.innerWidth - 24);
    tip.style.width = w + 'px';
    tip.style.left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12)) + 'px';
    const below = r.bottom + 8, h = tip.offsetHeight;
    tip.style.top = (below + h > window.innerHeight - 8 ? r.top - h - 8 : below) + 'px';
  }
  const hide = () => { tip.hidden = true; };
  // Underline the first occurrence of each term inside one rendered region.
  function annotate(root) {
    if (!root || !root.isConnected) return;
    const done = new Set([...root.querySelectorAll('.term')].map(el => el.dataset.term));
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {acceptNode: n =>
      !n.nodeValue.trim() || n.parentElement.closest('.term,button,a,select,option,h2,input,.term-tip,.eyebrow,.relation-kicker,.relation-table') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT});
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    for (let node of nodes) {
      for (const [key, re] of GLOSSARY) {
        if (done.has(key) || !node) continue;
        const m = node.nodeValue.match(re); if (!m) continue;
        const after = node.splitText(m.index), rest = after.splitText(m[0].length);
        const span = document.createElement('span');
        span.className = 'term'; span.dataset.term = key; span.tabIndex = 0; span.textContent = m[0];
        span.setAttribute('aria-label', `${m[0]} — 용어 설명 보기`);
        after.replaceWith(span); done.add(key); node = rest;
      }
    }
  }
  let pending = false;
  const targets = ['detail', 'relationPopup', 'comparisonBody', 'timeline'].map(id => document.getElementById(id)).filter(Boolean);
  const observer = new MutationObserver(() => {
    if (pending) return; pending = true;
    requestAnimationFrame(() => { observer.disconnect(); targets.forEach(annotate); targets.forEach(t => observer.observe(t, {childList: true, subtree: true})); pending = false; });
  });
  targets.forEach(t => { annotate(t); observer.observe(t, {childList: true, subtree: true}); });
  document.addEventListener('mouseover', e => { const t = e.target.closest('.term'); if (t) show(t); });
  document.addEventListener('mouseout', e => { if (e.target.closest('.term')) hide(); });
  document.addEventListener('focusin', e => { const t = e.target.closest('.term'); if (t) show(t); else hide(); });
  document.addEventListener('click', e => { const t = e.target.closest('.term'); if (t) { e.stopPropagation(); show(t); } else if (!e.target.closest('.term-tip')) hide(); }, true);
  window.addEventListener('scroll', hide, true);
  // Full glossary dialog.
  const dlg = document.getElementById('glossary');
  if (dlg) dlg.querySelector('.glossary-list').innerHTML = GLOSSARY.map(([k, , d]) => `<dt>${esc(k)}</dt><dd>${esc(d)}</dd>`).join('');
  document.addEventListener('click', e => { if (e.target.closest('[data-open-glossary]') && dlg) dlg.showModal(); });
})();
