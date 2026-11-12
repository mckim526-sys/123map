// Resolve public deep links without silently selecting an unrelated defendant.
function personRoute(hash, people) {
  const parts = String(hash || '').split('/');
  if (parts[0] !== '#person' || !parts[1] || parts.length > 3) return null;
  let id, caseId;
  try {
    id = decodeURIComponent(parts[1]);
    caseId = parts[2] ? decodeURIComponent(parts[2]) : '';
  } catch { return null; }
  const person = people.find(p => p.id === id);
  if (!person || !person.records?.length) return null;
  const record = person.records.find(r => r.id === caseId) || person.records[0];
  return {id:person.id, caseId:record.id};
}
if (typeof module !== 'undefined') module.exports = {personRoute};
