const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'reader-data.js'), 'utf8');
const data = {};
vm.runInNewContext(source + ';this.data={persons,catalogSources};', data);

test('reader article links contain MBC originals only', () => {
  const allowed = url => new URL(url).hostname === 'imnews.imbc.com';
  for (const person of data.data.persons) for (const record of person.records) {
    for (const news of record.news || []) assert.ok(allowed(news.url), `${person.id}/${record.id}: non-MBC link`);
  }
  for (const [, url] of data.data.catalogSources) assert.ok(allowed(url), 'non-MBC catalog link');
});

test('private verification source URLs are absent from public data bytes', () => {
  for (const url of source.match(/https?:[^"\s]+/g) || []) {
    const host = new URL(url).hostname;
    assert.ok(host === 'imbc.com' || host.endsWith('.imbc.com'), 'private source URL in public data');
  }
});

// 재판 상세의 안내 상자(note)는 3줄 이내 — 320px 화면에서도 3줄에 들어가는 길이(80자)까지
test('record notes stay within three lines (80 characters)', () => {
  for (const person of data.data.persons) for (const record of person.records) {
    const note = record.note || '';
    assert.ok(note.length <= 80, `${person.name}/${record.id}: note ${note.length}자 — 3줄(80자) 이내로 요약`);
  }
});

// 재판부 칸(심급 stages[i][1], 추가 일정 next[][1])에는 법원·재판부·사건번호·시간만 — 판사 이름(재판장·주심·배석)은 쓰지 않음
test('court fields do not name judges', () => {
  const COURT = /법원|지법|고법|지원|재판부|단독|합의|형사|민사|대법|특검/;
  const STOP = new Set(['확정', '취하', '보도', '선고', '미확인', '진행', '미정', '예정', '심리', '변론', '종결', '기각', '파기', '환송', '미진행', '미도달', '공판', '항소', '상고']);
  const isName = x => /^[가-힣]{2,4}$/.test(x) && !COURT.test(x) && !STOP.has(x);
  const judgeSeg = seg => /^주심\s*[가-힣]{2,4}/.test(seg) || /^[가-힣]{2,4}\s*(재판장|부장판사|판사|대법관)$/.test(seg)
    || seg.split(/\s*·\s*/).filter(Boolean).some(isName);
  for (const person of data.data.persons) for (const record of person.records) {
    const rows = [...(record.stages || []).map((st, i) => [`${i + 1}심`, st && st[1]]), ...(record.next || []).map(nx => ['일정', nx && nx[1]])];
    for (const [where, court] of rows) for (const seg of String(court || '').split(/\s+·\s+/)) {
      assert.ok(!judgeSeg(seg.trim()), `${person.name}/${record.id} ${where} 재판부 칸에 판사 이름: "${court}"`);
    }
  }
});
