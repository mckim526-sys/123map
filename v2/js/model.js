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

  // 두 인물을 잇는 이유(라벨). 연결이 없으면 null.
  function linkLabel(a, b, agency) {
    if (a.id === b.id) return null;
    const scope = scopeOf(agency);
    const manual = relations.find(([x, y, , only]) =>
      ((x === a.name && y === b.name) || (x === b.name && y === a.name)) && (!scope || !only || only === scope));
    if (manual) return manual[2];
    const ra = recordsIn(a, scope), rb = recordsIn(b, scope);
    const shared = ra.find(r => names(r, b.id)) || rb.find(r => names(r, a.id));
    if (shared) return shared.label;
    const sameTrial = ra.find(r => r.family && rb.some(o => o.family === r.family));
    if (sameTrial) return sameTrial.label;
    if ((!scope || scope === '내란특검') && CORE_LEADERS.includes(a.id) && CORE_MEMBERS.includes(b.id)) return '내란 본류';
    return null;
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
  function sharedCases(a, b, label) {
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
    linkLabel, triedTogether, trialmates, filterPeople, sharedCases, agencyRoot,
  };
})();
