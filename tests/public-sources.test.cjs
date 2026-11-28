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
