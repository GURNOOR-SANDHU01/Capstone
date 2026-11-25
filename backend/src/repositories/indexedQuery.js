/**
 * Paged Firestore list query that keeps working when a composite index is missing.
 *
 * 1. Runs the efficient indexed query (equality filters + range filters + orderBy + offset).
 * 2. If Firestore rejects it with FAILED_PRECONDITION ("The query requires an index"), it reruns
 *    the query with the EQUALITY filters only (served by automatic single-field indexes, no
 *    deployment needed) and applies range filters, sorting and paging in memory.
 *
 * Once `firestore.indexes.json` is deployed, step 1 succeeds and the fallback is never used.
 * The fallback reads at most FALLBACK_MAX documents per query, which is ample for per-user
 * lists at this app's scale.
 */
const { fromDoc } = require('../utils/docNormalizer');
const logger = require('../utils/logger');

const FALLBACK_MAX = 1000;
const warned = new Set();

const isMissingIndex = (err) =>
  Boolean(err) && (err.code === 9 || err.code === 'FAILED_PRECONDITION' || /requires an index/i.test(err.message || ''));

/** Comparable value for Firestore Timestamps, mock timestamps, ISO strings and numbers. */
function sortValue(v) {
  if (v === null || v === undefined) return -Infinity;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v._seconds === 'number') return v._seconds * 1000 + (v._nanoseconds || 0) / 1e6;
  if (typeof v.seconds === 'number') return v.seconds * 1000 + (v.nanoseconds || 0) / 1e6;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isNaN(t) ? v : t;
  }
  return v;
}

const getPath = (obj, path) => path.split('.').reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj);

const OPS = {
  '>=': (a, b) => a >= b,
  '>': (a, b) => a > b,
  '<=': (a, b) => a <= b,
  '<': (a, b) => a < b
};

/**
 * @param {object} p
 * @param {FirebaseFirestore.CollectionReference} p.collection
 * @param {Object<string, any>} p.equality    field -> value (undefined values are skipped)
 * @param {{field:string, op:string, value:any}[]} [p.ranges]
 * @param {{field:string, direction?:'asc'|'desc'}} p.orderBy
 * @param {number} [p.page=1]
 * @param {number} p.limit
 * @param {string} p.label  short name for the one-time warning log
 * @returns {Promise<{ items: object[], hasMore: boolean, indexFallback: boolean }>}
 */
async function pagedQuery({ collection, equality, ranges = [], orderBy, page = 1, limit, label }) {
  const eq = Object.entries(equality).filter(([, v]) => v !== undefined && v !== null);
  const rng = ranges.filter((r) => r.value !== undefined && r.value !== null);
  const direction = orderBy.direction || 'desc';
  const offset = (page - 1) * limit;

  let base = collection;
  for (const [f, v] of eq) base = base.where(f, '==', v);

  try {
    let q = base;
    for (const r of rng) q = q.where(r.field, r.op, r.value);
    const snap = await q.orderBy(orderBy.field, direction).limit(limit + 1).offset(offset).get();
    const docs = snap.docs.map(fromDoc);
    return { items: docs.slice(0, limit), hasMore: docs.length > limit, indexFallback: false };
  } catch (err) {
    if (!isMissingIndex(err)) throw err;
    if (!warned.has(label)) {
      warned.add(label);
      logger.warn(`Firestore composite index missing for ${label}; using in-memory fallback. Deploy firestore.indexes.json to restore indexed queries.`);
    }
  }

  const snap = await base.limit(FALLBACK_MAX).get();
  const sign = direction === 'desc' ? -1 : 1;
  const rows = snap.docs
    .map(fromDoc)
    .filter((d) => rng.every((r) => {
      const v = getPath(d, r.field);
      return v !== undefined && v !== null && OPS[r.op](sortValue(v), sortValue(r.value));
    }))
    .sort((a, b) => {
      const x = sortValue(getPath(a, orderBy.field));
      const y = sortValue(getPath(b, orderBy.field));
      return x < y ? -sign : x > y ? sign : 0;
    });
  const pageRows = rows.slice(offset, offset + limit + 1);
  return { items: pageRows.slice(0, limit), hasMore: pageRows.length > limit, indexFallback: true };
}

module.exports = { pagedQuery, isMissingIndex, sortValue };
