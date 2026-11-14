// 재판 목록: 한 줄에 "누가 · 어떤 사건 · 최근 판단 · 어디까지" 를 훑어볼 수 있게
const ListView = (() => {
  const PENDING = /미확인|확인 중|대조 중|해당 없음|미도달|예정/;
  const VERDICT = /징역|금고|벌금|무죄|유죄|공소기각|집행유예|선고유예|무기|사형|면소|기각|확정/; // 법원 판단만 (심리·공판 등 절차 제외)

  // 대표 사건: 선택한 특검의 사건 → 내란 본류 → 첫 사건 (모든 행이 같은 기준)
  function summary(p, agency) {
    const recs = agency === 'all' ? p.records : p.records.filter(r => r.agency === agency);
    const pool = recs.length ? recs : p.records;
    const rec = pool.find(r => r.family === 'main') || pool[0];
    const stages = rec.stages || [];
    let latest = null;
    stages.forEach((s, i) => { if (VERDICT.test(s[0] || '') && !PENDING.test(s[0]) && !/예정/.test(s[2] || '')) latest = { n: i + 1, s }; });
    const next = stages.find(s => /예정/.test(s[2] || ''));
    return { rec, count: pool.length, prog: Progress.of(rec), latest, next };
  }

  function stageCell(prog) {
    const bars = [1, 2, 3].map(n => {
      const st = prog.stage === null ? '' : n < prog.stage ? 'is-done' : n === prog.stage ? (prog.phase === 'final' ? 'is-final' : 'is-current') : '';
      return `<i class="${st}"></i>`;
    }).join('');
    const label = prog.stage === null ? '확인 중'
      : `${stageName(prog.stage)} ${{ final: '확정', ongoing: '진행 중', decided: '선고' }[prog.phase] || ''}`;
    return `<span class="row__stage"><span class="mini-steps" aria-hidden="true">${bars}</span><span class="caption">${esc(label)}</span></span>`;
  }

  function row(p, agency, sel) {
    const on = sel?.id === p.id; // 선택한 사람의 행은 강조만 (내용은 바꾸지 않음)
    const { rec, count, prog, latest, next } = summary(p, agency);
    const ymd = t => (String(t || '').match(/\d{4}\.\d{2}\.\d{2}/) || [''])[0]; // 사건번호 등 부가 정보 제외
    const when = [ymd(latest?.s[2]), next && ymd(next[2]) ? `다음 ${ymd(next[2])}` : ''].filter(Boolean).join(' · ');
    return `
      <button class="row ${on ? 'is-selected' : ''}" data-id="${esc(p.id)}" data-case-link="${esc(rec.id)}"${on ? ' aria-current="true"' : ''}>
        <span class="row__who">${avatar(p, 'ava--md')}<span class="row__name"><b>${esc(p.name)}</b><span class="caption">${esc(p.role)}</span></span></span>
        <span class="row__case"><b>${esc(rec.label)}${count > 1 ? ` <span class="caption">외 ${count - 1}건</span>` : ''}</b><span class="caption">${esc(rec.agency)}</span></span>
        <span class="row__verdict ${latest ? '' : 'is-pending'}"><b>${latest ? `${stageName(latest.n)} ${esc(latest.s[0])}` : '선고 전'}</b><span class="caption">${esc(when || '일정 확인 중')}</span></span>
        ${stageCell(prog)}
        <span class="row__go" aria-hidden="true">›</span>
      </button>`;
  }

  // sel: 선택한 인물 { id, caseId } 또는 null → 해당 행을 강조
  function render(list, agency = 'all', sel = null) {
    // 표 머리는 위에 고정
    const head = list.length ? `<div class="list-head" aria-hidden="true"><span>인물</span><span>대표 사건</span><span>최근 판단</span><span>진행 <small>1심·2심·대법원</small></span><span></span></div>` : '';
    $('#listPane').innerHTML = head
      + (list.length ? list.map(p => row(p, agency, sel)).join('') : '<p class="empty">검색 결과가 없습니다.</p>');
  }

  return { render };
})();
