// Progress means the latest documented procedural stage, not a predicted appeal.
function trialProgress(record) {
  if (record.progress && [1,2,3].includes(record.progress.stage)
      && ['ongoing','decided','final'].includes(record.progress.phase)) return record.progress;
  const status = record.status || '';
  const stages = (record.stages || []).map(s => s.filter(Boolean).join(' '));
  const uncertain = /미확인|확인 중|대조 중|여부/;
  const finalText = text => /확정/.test(text) && !/확정\s*(여부|미확인|전)|미확정/.test(text);
  if (/파기[·\s]*환송|파기·환송/.test(status)) return {stage:null,phase:'unknown',label:'파기환송 · 환송심 진행 단계 확인 중'};
  const known = stages.map((text,i) => {
    if (/미도달|해당 없음/.test(text)) return 0;
    const clear = text.replace(/(?:상고|항소|확정|선고)\s*(?:여부|결과)?\s*(?:미확인|확인 중|대조 중)[^·]*/g,'');
    return /징역|벌금|무죄|유죄|공소기각|집행유예|공판|결심|구형|변론 종결|선고 예정|심리 예정|심리 중|심리 확인|상고 제출|항소 제기|상고 제기|원심 확정/.test(clear) ? i+1 : 0;
  });
  if (finalText(status)) {
    const explicit = status.match(/([123])심[^·]*확정/);
    const finalStage = stages.reduce((n,s,i) => finalText(s) ? i+1 : n,0);
    const stage = explicit ? Number(explicit[1]) : (/대법원/.test(status) ? 3 : finalStage || Math.max(...known,0));
    return {stage:stage || null,phase:'final',label:stage ? stage+'심 확정' : '확정 · 최종 심급 확인 중'};
  }
  const confirmedStatus = status.split('·').filter(s => !/상고 여부|항소 여부|확정 여부|경과 대조/.test(s)).join(' · ');
  if (/상고심|대법원.*(?:심리|배당)|상고(?!\s*(?:없음|없이|여부))/.test(confirmedStatus)) return {stage:3,phase:'ongoing',label:'3심 · 상고심 단계'};
  if (/항소심|항소(?!\s*(?:없음|없이|취하|여부))/.test(confirmedStatus)) return {stage:2,phase:'ongoing',label:'2심 · 항소심 단계'};
  const explicit = [...status.matchAll(/([123])심/g)].map(m=>Number(m[1]));
  const stage = Math.max(...known,...explicit,0);
  if (!stage) return {stage:null,phase:'unknown',label:'진행 심급 확인 중'};
  const text = status+' '+(stages[stage-1] || '');
  const phase = /공판|결심|구형|변론 종결|선고 예정|심리|재판 중단/.test(text) ? 'ongoing' : 'decided';
  return {stage,phase,label:stage+'심 · '+(phase==='ongoing' ? '진행 경과 확인' : '판단 확인')+(uncertain.test(status)?' / 후속 경과 확인 중':'')};
}

function trialProgressHtml(record) {
  const p = trialProgress(record);
  return `<section class="trial-progress" aria-label="재판 진행 단계"><ol>${[1,2,3].map(stage=>{
    const state = p.stage===null ? 'unknown' : stage<p.stage ? 'done' : stage===p.stage ? (p.phase==='final'?'final':'current') : 'future';
    return `<li class="${state}" ${stage===p.stage?'aria-current="step"':''}><span>${stage}심</span>${state==='done'?'<small>✓</small>':state==='current'?'<small>현재</small>':state==='final'?'<small>확정</small>':''}</li>`;
  }).join('')}</ol><p>${esc(p.label)}</p></section>`;
}
