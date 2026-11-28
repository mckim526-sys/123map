// 데이터 모델: 인물·사건 사이의 관계를 '기록된 사실'로만 계산합니다.
const Model = (() => {
  /* global persons, agencies, relations, catalogSources */
  const people = persons;
  const byId = new Map(people.map(p => [p.id, p]));
  const ROOT_ID = 'yoon';

  // 특검 최종 브리핑 발표 기소 인원 (사이트에는 실명 보도 인물만 수록)
  const AGENCY_TOTALS = {
    '내란특검': [27, '출범 전 검찰·군검찰 기소 인물 포함 수록'],
    '김건희 특검': [76, '실명 미공개 피고인·양평고속도로 사건 등 미수록'],
    '해병대 특검': [33, '단체대화방 위증 기소 2명 미수록'],
    '종합특검': [58, '법인 포함 발표 인원'],
  };
  // 내란 본류 핵심 피고인 (명시적 기록이 없어도 본류로 연결)
  const CORE_LEADERS = ['yoon', 'kim'];
  const CORE_MEMBERS = ['kim', 'noh', 'gun', 'cho', 'bong', 'mok', 'seung'];

  const get = id => byId.get(id) || byId.get(ROOT_ID);
  const scopeOf = agency => (agency && agency !== 'all') ? agency : null;
  const recordsIn = (p, scope) => scope ? p.records.filter(r => r.agency === scope) : p.records;
  const names = (r, id) => (r.members || []).includes(id);

  // 두 인물을 잇는 사건들 (순서: 같은 재판 → 같은 사건 별도 재판 → 그 밖의 관계)
  // 선 이름(linkLabel)·연결 팝업·팝업에서 누르는 재판 상세가 모두 이 목록의 같은 사건을 씀
  //  { key, title, kind: 'co'|'sep'|'rel', records: [{ person, record }] }
  const FAMILY_TIE = /배우자|모녀|남매|부부|가족|오빠|누나|형제|자매|부자|모자/;
  function sameTrialRec(p, r, other) { // other 사람의 기록 중 r과 같은 재판인 것
    return other.records.find(o => o.id === r.id && (names(o, p.id) || names(r, other.id)))
      || (r.family && other.records.find(o => o.family === r.family))
      || other.records.find(o => names(o, p.id) && o.label === r.label)
      || other.records.find(o => names(r, other.id) && o.label === r.label);
  }
  function linkCases(a, b, agency) {
    if (a.id === b.id) return [];
    const scope = scopeOf(agency);
    const ra = recordsIn(a, scope), rb = recordsIn(b, scope);
    const out = [], seen = new Set();
    for (const r of ra) { // 같은 재판
      if (!trialmates(a, r).has(b.id)) continue;
      const key = 'co:' + (r.family || r.id); if (seen.has(key)) continue; seen.add(key);
      const o = sameTrialRec(a, r, b);
      out.push({ key, title: r.label, kind: 'co', records: [{ person: a, record: r }, ...(o && (!scope || o.agency === scope) ? [{ person: b, record: o }] : [])] });
    }
    for (const [p, q, rs, qs] of [[a, b, ra, rb], [b, a, rb, ra]]) { // 같은 사건 · 별도 재판
      for (const r of rs) {
        if (!(r.related || []).includes(q.id) || trialmates(p, r).has(q.id)) continue;
        const o = qs.find(x => (x.related || []).includes(p.id));
        const key = 'sep:' + [r.id, o?.id].sort().join('|'); if (seen.has(key)) continue; seen.add(key);
        out.push({ key, title: `${r.label} · 별도 재판`, kind: 'sep', records: [{ person: p, record: r }, ...(o ? [{ person: q, record: o }] : [])] });
      }
    }
    const manual = relations.find(([x, y, , only]) =>
      ((x === a.name && y === b.name) || (x === b.name && y === a.name)) && (!scope || !only || only === scope));
    if (manual) { // 그 밖의 관계: 같은 이름의 기록이 있으면 함께 보여 줌
      const label = manual[2], recs = [];
      for (const [p, rs] of [[a, ra], [b, rb]]) for (const r of rs)
        if (r.label === label || (r.label?.length >= 4 && label.includes(r.label))) recs.push({ person: p, record: r });
      out.push({ key: 'rel:' + label, title: label, kind: 'rel', records: recs, family: FAMILY_TIE.test(label) });
    } else if (!out.length && (!scope || scope === '내란특검') && CORE_LEADERS.includes(a.id) && CORE_MEMBERS.includes(b.id)) {
      out.push({ key: 'rel:core', title: '내란 본류', kind: 'rel', records: [] });
    }
    // 가족 관계(배우자 등)는 선 이름으로 가장 먼저
    const fam = out.findIndex(c => c.family);
    if (fam > 0) out.unshift(...out.splice(fam, 1));
    return out;
  }
  // 두 인물을 잇는 이유(라벨): linkCases의 첫 사건 이름. 연결이 없으면 null.
  function linkLabel(a, b, agency) {
    const c = linkCases(a, b, agency)[0];
    return c ? c.title : null;
  }

  // 같은 사건(혐의)인데 따로 기소돼 별도로 재판받는 사람 id (record.related에서 같은 재판 사람은 뺌)
  function separateTrial(person, record) {
    const mates = trialmates(person, record);
    return (record.related || []).filter(id => id !== person.id && !mates.has(id) && byId.has(id));
  }

  // 같은 재판에서 함께 기소·재판받는 사이인가
  function triedTogether(a, b, agency) {
    if (a.id === b.id) return false;
    const scope = scopeOf(agency);
    const ra = recordsIn(a, scope), rb = recordsIn(b, scope);
    return ra.some(r => names(r, b.id)) || rb.some(r => names(r, a.id))
      || ra.some(r => r.family && rb.some(o => o.family === r.family));
  }

  // 한 재판의 다른 피고인 id 집합
  function trialmates(person, record) {
    const ids = new Set(record?.members || []);
    if (record?.family) people.forEach(p => { if (p.records.some(r => r.family === record.family)) ids.add(p.id); });
    ids.delete(person.id);
    return ids;
  }

  // 검색어·특검 필터 적용
  // 특검 → 검색어 순으로 좁힘
  // 검색: 이름·직책·사건명에 검색어가 들어간 사람
  function filterPeople(agency, query) {
    const q = (query || '').trim();
    return people.filter(p => (agency === 'all' || p.agencies.includes(agency))
      && (!q || [p.name, p.role, ...p.records.map(r => r.title)].join(' ').includes(q)));
  }

  // 연결선의 근거가 되는 사건 묶음 (공개된 사건 기록만 사용)
  function sharedCases(a, b, label, agency) {
    if (agency !== undefined) return linkCases(a, b, agency);
    if (!label || a.id === b.id) return [];
    const groups = new Map();
    for (const [p, other] of [[b, a], [a, b]]) {
      for (const r of p.records) {
        const related = names(r, other.id)
          || (r.family && other.records.some(o => o.family === r.family))
          || r.label === label
          || (r.label?.length >= 4 && label.includes(r.label))
          || other.records.some(o => names(o, p.id) && o.label === r.label);
        if (!related) continue;
        const key = r.family || r.agency + ':' + r.label;
        if (!groups.has(key)) groups.set(key, { title: r.label, records: [] });
        groups.get(key).records.push({ person: p, record: r });
      }
    }
    return [...groups.values()];
  }

  function agencyRoot(agency) {
    return agency === '김건희 특검' ? 'keon' : agency === '해병대 특검' ? 'park-jh' : ROOT_ID;
  }

  return {
    people, get, ROOT_ID, AGENCY_TOTALS, agencies, sources: catalogSources,
    linkLabel, linkCases, triedTogether, trialmates, separateTrial, filterPeople, sharedCases, agencyRoot,
  };
})();
