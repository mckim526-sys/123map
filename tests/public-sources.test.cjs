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
