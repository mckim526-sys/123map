let relationPopupState = null, relationCloseTimer, suppressRelationFocus = false;
const relationPopup = document.getElementById('relationPopup');

function closeRelationPopup(restoreFocus = false) {
  clearTimeout(relationCloseTimer);
  const anchor = relationPopupState?.anchor;
  relationPopup.hidden = true;
  relationPopupState = null;
  document.querySelectorAll('.relation-preview').forEach(el => {
    el.classList.remove('relation-preview'); el.removeAttribute('aria-expanded');
  });
  if (restoreFocus && anchor?.isConnected) {
    suppressRelationFocus = true; anchor.focus(); suppressRelationFocus = false;
  }
}

function renderRelationPopup() {
  const {a, b, cases, index} = relationPopupState;
  const entry = cases[index];
  const articles = [...new Map((entry?.records || []).flatMap(v => v.record.news || [])
    .filter(n => /^https:\/\/imnews\.imbc\.com\//.test(n.url)).map(n => [n.url, n])).values()].slice(0, 2);
  relationPopup.innerHTML = `<button class="relation-close" aria-label="연결 설명 닫기">×</button>
    <p class="relation-kicker">인물 사이의 연결</p>
    <div class="relation-heading">${img(b, 'relation-photo')}<div><h2 id="relationTitle">${esc(a.name)} · ${esc(b.name)}</h2><p>${esc(connection(a,b))}</p></div></div>
    ${cases.length > 1 ? `<label class="relation-picker">연결된 사건 <select id="relationCase" aria-label="연결된 사건 선택">${cases.map((c,i)=>`<option value="${i}" ${i===index?'selected':''}>${esc(c.title)}</option>`).join('')}</select></label>` : `<h3>연결된 사건</h3><p class="relation-case-name">${esc(entry?.title || connection(a,b))}</p>`}
    <h3>당시 상황 · 기소 내용</h3>
    ${entry ? entry.records.map(({person, record}) => `<section class="relation-account"><b>${esc(person.name)}의 사건 기록</b><p class="relation-record-title">${esc(record.title)}</p>${(record.charges || []).slice(0,3).map(c=>`<p>${esc(c.act)}</p>`).join('') || '<p>당시 상황에 대한 구체적인 설명을 확인 중입니다.</p>'}${trialProgressHtml(record)}<span class="relation-case-status">재판 상태 · ${esc(record.status || '확인 중')}</span></section>`).join('') : '<p class="relation-pending">연결 관계는 기록되어 있지만, 당시 상황을 설명할 사건 자료는 확인 중입니다.</p>'}
    <p class="relation-caution">기소 내용은 법원이 인정한 사실과 다를 수 있습니다. 연결선은 공모나 유죄를 뜻하지 않습니다.</p>
    ${articles.length ? `<div class="relation-news">${articles.map(n=>`<a href="${esc(n.url)}" target="_blank" rel="noopener noreferrer"><small>MBC · ${esc(n.date)}</small>${esc(n.title)} ↗</a>`).join('')}</div>` : ''}
    <button class="relation-open" data-open-relation-person="${esc(b.id)}">${esc(b.name)} 재판 보기 ↗</button>`;
  positionRelationPopup();
}

function positionRelationPopup() {
  if (!relationPopupState) return;
  const gap = 12, r = relationPopupState.anchor.getBoundingClientRect();
  if (matchMedia('(max-width:760px)').matches) {
    relationPopup.style.left = '12px'; relationPopup.style.top = 'auto';
    return;
  }
  const width = relationPopup.offsetWidth, height = relationPopup.offsetHeight;
  let left = r.right + gap;
  if (left + width > window.innerWidth - gap) left = r.left - width - gap;
  relationPopup.style.left = Math.max(gap, Math.min(left, window.innerWidth-width-gap)) + 'px';
  relationPopup.style.top = Math.max(gap, Math.min(r.top-16, window.innerHeight-height-gap)) + 'px';
}

function showRelationPopup(aId, bId, anchor, pinned = false) {
  const a = lookup(aId), b = lookup(bId), label = connection(a,b);
  if (!label || a.id === b.id) return;
  clearTimeout(relationCloseTimer);
  if (relationPopupState?.pinned && !pinned) return;
  if (relationPopupState?.anchor === anchor) {
    if (pinned) { relationPopupState.pinned = true; relationPopup.querySelector('.relation-close').focus(); }
    return;
  }
  closeRelationPopup();
  relationPopupState = {a,b,anchor,pinned,cases:relationContext(a,b,label),index:0};
  anchor.classList.add('relation-preview'); anchor.setAttribute('aria-expanded','true');
  relationPopup.hidden = false; renderRelationPopup();
  if (pinned) relationPopup.querySelector('.relation-close').focus();
}

function relationTarget(element) {
  const related = element.closest('[data-related-to]');
  if (related) return {a: related.dataset.relatedTo, b: related.dataset.id, anchor: related};
  const node = element.closest('#nodes [data-id]');
  if (node && detailOpen && node.dataset.id !== selected && connection(lookup(selected), lookup(node.dataset.id))) {
    return {a:selected, b:node.dataset.id, anchor:node};
  }
  return null;
}

document.addEventListener('pointerover', e => {
  if (e.pointerType !== 'mouse') return;
  const target = relationTarget(e.target);
  if (target) showRelationPopup(target.a,target.b,target.anchor);
});
document.addEventListener('pointerout', e => {
  if (!relationPopupState || relationPopupState.pinned || e.pointerType !== 'mouse') return;
  const next = e.relatedTarget;
  if (next && (relationPopup.contains(next) || relationPopupState.anchor.contains(next))) return;
  clearTimeout(relationCloseTimer);
  relationCloseTimer = setTimeout(() => closeRelationPopup(), 200);
});
relationPopup.addEventListener('pointerover', () => clearTimeout(relationCloseTimer));
document.addEventListener('pointerdown', e => {
  if (relationPopupState && !relationPopup.contains(e.target) && !relationPopupState.anchor.contains(e.target)) closeRelationPopup();
});
document.addEventListener('focusin', e => {
  if (suppressRelationFocus) return;
  const target = relationTarget(e.target);
  if (target) showRelationPopup(target.a,target.b,target.anchor);
});
relationPopup.addEventListener('change', e => {
  if (e.target.id === 'relationCase') {
    relationPopupState.index = Number(e.target.value); renderRelationPopup();
    relationPopup.querySelector('#relationCase').focus();
  }
});
relationPopup.addEventListener('click', e => {
  if (e.target.closest('.relation-close')) { closeRelationPopup(true); return; }
  const button = e.target.closest('[data-open-relation-person]');
  if (button) {
    const id = button.dataset.openRelationPerson; closeRelationPopup();
    if ($('#comparison').open) $('#comparison').close();
    go(id);
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && relationPopupState) {
    e.preventDefault(); e.stopImmediatePropagation(); closeRelationPopup(true);
  }
}, true);
window.addEventListener('resize', () => closeRelationPopup());
