// 재판 진행 단계: 기록된 마지막 절차 단계만 표시하고, 상소를 예측하지 않습니다.
const Progress = (() => {
  const UNCERTAIN = /미확인|확인 중|대조 중|여부/;
  const PROCEDURE = /징역|벌금|무죄|유죄|공소기각|집행유예|공판|결심|구형|변론 종결|선고 예정|심리 예정|심리 중|심리 확인|상고 제출|항소 제기|상고 제기|원심 확정/;
  const isFinal = t => /확정/.test(t) && !/확정\s*(여부|미확인|전)|미확정/.test(t);

  function of(record) {
    const given = record.progress;
    if (given && [1, 2, 3].includes(given.stage) && ['ongoing', 'decided', 'final'].includes(given.phase)) return given;

    const status = record.status || '';
    const stages = (record.stages || []).map(s => s.filter(Boolean).join(' '));

    if (/파기[·\s]*환송/.test(status)) return { stage: null, phase: 'unknown', label: '파기환송 · 환송심 진행 단계 확인 중' };

    // 각 심급 칸이 실제 절차 정보를 담고 있는지
    const reached = stages.map((t, i) => {
      if (/미도달|해당 없음/.test(t)) return 0;
      const clean = t.replace(/(?:상고|항소|확정|선고)\s*(?:여부|결과)?\s*(?:미확인|확인 중|대조 중)[^·]*/g, '');
      return PROCEDURE.test(clean) ? i + 1 : 0;
    });

    if (isFinal(status)) {
      const named = status.match(/([123])심[^·]*확정/);
      const lastFinal = stages.reduce((acc, t, i) => isFinal(t) ? i + 1 : acc, 0);
      const stage = named ? +named[1] : (/대법원/.test(status) ? 3 : lastFinal || Math.max(...reached, 0));
      return { stage: stage || null, phase: 'final', label: stage ? `${stage}심 확정` : '확정 · 최종 심급 확인 중' };
    }

    const sure = status.split('·').filter(s => !/상고 여부|항소 여부|확정 여부|경과 대조/.test(s)).join(' · ');
    if (/상고심|대법원.*(?:심리|배당)|상고(?!\s*(?:없음|없이|여부))/.test(sure)) return { stage: 3, phase: 'ongoing', label: '3심 · 상고심 단계' };
    if (/항소심|항소(?!\s*(?:없음|없이|취하|여부))/.test(sure)) return { stage: 2, phase: 'ongoing', label: '2심 · 항소심 단계' };

    const mentioned = [...status.matchAll(/([123])심/g)].map(m => +m[1]);
    const stage = Math.max(...reached, ...mentioned, 0);
    if (!stage) return { stage: null, phase: 'unknown', label: '진행 심급 확인 중' };
    const ctx = status + ' ' + (stages[stage - 1] || '');
    const phase = /공판|결심|구형|변론 종결|선고 예정|심리|재판 중단/.test(ctx) ? 'ongoing' : 'decided';
    return {
      stage, phase,
      label: `${stage}심 · ${phase === 'ongoing' ? '진행 경과 확인' : '판단 확인'}${UNCERTAIN.test(status) ? ' / 후속 경과 확인 중' : ''}`,
    };
  }

  // 1·2·3심 진행 막대
  function html(record) {
    const p = of(record);
    const steps = [1, 2, 3].map(n => {
      const state = p.stage === null ? 'unknown' : n < p.stage ? 'done' : n === p.stage ? (p.phase === 'final' ? 'final' : 'current') : 'todo';
      const tag = { done: '✓', current: '현재', final: '확정' }[state] || '';
      return `<li class="step step--${state}"${n === p.stage ? ' aria-current="step"' : ''}><span>${n}심</span>${tag ? `<small>${tag}</small>` : ''}</li>`;
    }).join('');
    return `<section class="stepper" aria-label="재판 진행 단계"><ol>${steps}</ol><p>${esc(p.label)}</p></section>`;
  }

  return { of, html };
})();
