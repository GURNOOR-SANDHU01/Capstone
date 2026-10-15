/**
 * Verifies firestore.indexes.json covers every composite query the repositories issue.
 *
 * Firestore rule modelled here: a composite index serves a query when its leading fields are
 * exactly the query's equality fields (any order), followed by the orderBy field with the same
 * direction, followed by the range-filtered fields. Equality-only and single-orderBy queries use
 * automatic single-field indexes and are not listed.
 *
 * The definitions themselves were taken from Firestore's own FAILED_PRECONDITION suggestions
 * (read-only limit(1) probes against sentience-6f40e on 2026-10-15).
 */
const indexFile = require('../firestore.indexes.json');

const subsets = (keys) => keys.reduce((acc, k) => acc.concat(acc.map((s) => [...s, k])), [[]]);

const QUERY_SHAPES = [
  // journalRepository.listByUser: optional date range and severity
  ...subsets(['range', 'severity']).map((o) => ({
    source: `journalRepository.listByUser ${o.join('+') || 'base'}`,
    collection: 'journal_entries',
    equality: ['user_id', ...(o.includes('severity') ? ['safety_flags.severity_flag'] : [])],
    orderBy: 'created_at',
    range: o.includes('range') ? ['entry_date'] : []
  })),
  // journalRepository.listSharedByUser (doctor view; no extra filters exposed)
  { source: 'journalRepository.listSharedByUser', collection: 'journal_entries', equality: ['user_id', 'visibility'], orderBy: 'created_at', range: [] },
  // memoryRepository.listByUser
  ...subsets(['type', 'importance']).map((o) => ({
    source: `memoryRepository.listByUser ${o.join('+') || 'base'}`,
    collection: 'memories',
    equality: ['user_id', ...(o.includes('type') ? ['memory_type'] : [])],
    orderBy: 'created_at',
    range: o.includes('importance') ? ['importance_score'] : []
  })),
  // reflectionRepository.listByUser
  ...subsets(['entry_id']).map((o) => ({
    source: `reflectionRepository.listByUser ${o.join('+') || 'base'}`,
    collection: 'reflection_prompts_and_responses',
    equality: ['user_id', ...o],
    orderBy: 'generated_at',
    range: []
  })),
  // safetyRepository.listAlertsForUser / listAlertsForTherapist
  ...subsets(['alert_status', 'severity']).map((o) => ({
    source: `safetyRepository.listAlertsForUser ${o.join('+') || 'base'}`,
    collection: 'red_flag_alert_logs',
    equality: ['user_id', ...o],
    orderBy: 'triggered_at',
    range: []
  })),
  ...subsets(['user_id', 'alert_status', 'severity']).map((o) => ({
    source: `safetyRepository.listAlertsForTherapist ${o.join('+') || 'base'}`,
    collection: 'red_flag_alert_logs',
    equality: ['therapist_id', ...o],
    orderBy: 'triggered_at',
    range: []
  })),
  { source: 'consentRepository.listAuditLogs', collection: 'consent_audit_logs', equality: ['user_id'], orderBy: 'action_timestamp', range: [] },
  ...subsets(['provider']).map((o) => ({
    source: `biometricRepository.listLogsForUser ${o.join('+') || 'base'}`,
    collection: 'biometric_sync_logs',
    equality: ['user_id', ...o],
    orderBy: 'sync_timestamp',
    range: []
  }))
];

function serves(index, q) {
  if (index.collectionGroup !== q.collection || index.queryScope !== 'COLLECTION') return false;
  const f = index.fields;
  const n = q.equality.length;
  if (f.length !== n + 1 + q.range.length) return false;
  const eq = new Set(f.slice(0, n).map((x) => x.fieldPath));
  if (!q.equality.every((e) => eq.has(e))) return false;
  if (f[n].fieldPath !== q.orderBy || f[n].order !== 'DESCENDING') return false;
  return q.range.every((r, k) => f[n + 1 + k].fieldPath === r);
}

describe('firestore.indexes.json', () => {
  it('is well-formed', () => {
    expect(Array.isArray(indexFile.indexes)).toBe(true);
    expect(Array.isArray(indexFile.fieldOverrides)).toBe(true);
    for (const idx of indexFile.indexes) {
      expect(typeof idx.collectionGroup).toBe('string');
      expect(idx.queryScope).toBe('COLLECTION');
      expect(idx.fields.length).toBeGreaterThanOrEqual(2);
      for (const field of idx.fields) {
        expect(Object.keys(field).sort()).toEqual(['fieldPath', 'order']);
        expect(['ASCENDING', 'DESCENDING']).toContain(field.order);
      }
    }
    const keys = indexFile.indexes.map((i) => JSON.stringify(i));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(QUERY_SHAPES.map((q) => [q.source, q]))('serves %s with exactly one index', (_name, q) => {
    expect(indexFile.indexes.filter((i) => serves(i, q))).toHaveLength(1);
  });

  it('contains no index that no query uses', () => {
    const unused = indexFile.indexes.filter((i) => !QUERY_SHAPES.some((q) => serves(i, q)));
    expect(unused).toEqual([]);
  });
});
