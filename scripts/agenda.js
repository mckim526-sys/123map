// 오늘 확인할 재판 목록 — 매일 자동 업데이트가 이 목록만 확인합니다 (넓은 뉴스 검색 대신 기록된 일정 기준).
//   node scripts/agenda.js            (오늘, 한국 시간)
//   node scripts/agenda.js --date 2026-11-18
//   node scripts/agenda.js --json     (기계용)
// 분류
//   ① 결과 확인: 어제·오늘 '예정'이던 선고·공판 → 결과가 나왔는지
//   ② 상소 확인: 1심·2심 선고 후 7~14일이 지났는데 다음 심급이 비어 있음 → 항소·상고 여부(상소 기간 7일)
//   ③ 지난 일정: 날짜가 이틀 이상 지났는데 아직 '예정'으로 남음 → 결과 미반영
//   ④ 다가오는 일정(7일): 참고
const fs = require('fs'), vm = require('vm'), path = require('path');
const args = process.argv.slice(2);
const c = {}; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'reader-data.js'), 'utf8') + ';this.p=persons', c);

const kst = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const today = (args[args.indexOf('--date') + 1] && args.includes('--date')) ? args[args.indexOf('--date') + 1] : kst;
const day = d => Date.parse(d + 'T00:00:00Z') / 864e5;
const T = day(today);
const ymdOf = s => ((s[2] || '').match(/(\d{4})\.(\d{2})\.(\d{2})/) || []).slice(1).join('-');
const planned = s => /예정/.test((s[0] || '') + (s[2] || ''));
const VERDICT = /징역|금고|벌금|무죄|유죄|공소기각|집행유예|선고유예|무기|사형|면소|기각/;
const OPEN = s => !s || !s[0] || /^(미확인|미도달(\s*확인 당시)?|판단 전|선고 결과 미확인|판결 미확인)$/.test(s[0].trim());
const STAGE = ['1심', '2심', '대법원'];

const out = { date: today, check: [], appeal: [], overdue: [], upcoming: [] };
const seen = new Set();
for (const p of c.p) for (const r of p.records) {
  const st = r.stages || [];
  st.forEach((s, i) => {
    const d = ymdOf(s); if (!d) return;
    const key = [r.family || r.id, i, d].join('|');
    const item = () => ({ key, date: d, stage: STAGE[i], text: s[0], court: s[1] || '', label: r.label, agency: r.agency, people: [], record: r.id });
    const push = list => {
      let it = list.find(x => x.key === key);
      if (!it) { it = item(); list.push(it); }
      if (!it.people.some(v => v.id === p.id)) it.people.push({ id: p.id, name: p.name, record: r.id });
    };
    const dd = day(d) - T;
    if (planned(s)) {
      if (dd === 0 || dd === -1) push(out.check);
      else if (dd < -1) push(out.overdue);
      else if (dd <= 7) push(out.upcoming);
    } else if (i < 2 && VERDICT.test(s[0] || '') && !/확정/.test(s[0] || '') && dd <= -7 && dd >= -14 && OPEN(st[i + 1])) {
      push(out.appeal);
    }
  });
}
for (const k of ['check', 'appeal', 'overdue', 'upcoming']) out[k].sort((a, b) => a.date.localeCompare(b.date));

if (args.includes('--json')) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
const line = x => `  - ${x.date} ${x.stage} ${x.text} · ${x.label} (${x.agency}) — ${x.people.map(v => v.name).join('·')}${x.court ? ` · ${x.court}` : ''}`;
console.log(`[${today} 확인 목록]`);
console.log(`① 결과 확인 (어제·오늘 예정) ${out.check.length}건`); out.check.forEach(x => console.log(line(x)));
console.log(`② 상소 여부 확인 (선고 후 7~14일, 다음 심급 비어 있음) ${out.appeal.length}건`); out.appeal.forEach(x => console.log(line(x)));
console.log(`③ 지난 일정 미반영 (이틀 이상 지난 '예정') ${out.overdue.length}건`); out.overdue.forEach(x => console.log(line(x)));
console.log(`④ 다가오는 일정 (7일) ${out.upcoming.length}건`); out.upcoming.forEach(x => console.log(line(x)));
const n = out.check.length + out.appeal.length + out.overdue.length;
console.log(n ? `→ 확인할 것 ${n}건` : '→ 오늘은 확인할 것이 없습니다');
