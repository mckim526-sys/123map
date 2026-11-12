// Read only already-published case descriptions. Never infer a joint conviction.
function relationContext(a, b, label) {
  if (!label || a.id === b.id) return [];
  const groups = new Map();
  for (const [person, other] of [[b, a], [a, b]]) {
    for (const record of person.records || []) {
      const linked = (record.members || []).includes(other.id)
        || (record.family && (other.records || []).some(r => r.family === record.family))
        || record.label === label
        || (record.label?.length >= 4 && label.includes(record.label))
        || (other.records || []).some(r => (r.members || []).includes(person.id) && r.label === record.label);
      if (!linked) continue;
      const key = record.family || record.agency + ':' + record.label;
      if (!groups.has(key)) groups.set(key, {title: record.label, records: []});
      groups.get(key).records.push({person, record});
    }
  }
  return [...groups.values()];
}
