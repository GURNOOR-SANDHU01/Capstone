const { db, Timestamp } = require('../config/firebase/firestore');
const { fromDoc } = require('../utils/docNormalizer');

/**
 * Minimal data-access helper for collections whose queries are equality-only
 * (served by Firestore's automatic single-field indexes, no composite index needed).
 * Sorting is done in memory by the caller.
 */
class SimpleRepository {
  constructor(collectionName) {
    this.collectionName = collectionName;
    this.collection = db.collection(collectionName);
  }

  async create(data) {
    const now = Timestamp.now();
    const doc = { ...data, created_at: now, updated_at: now };
    const ref = await this.collection.add(doc);
    return { id: ref.id, ...doc };
  }

  async getById(id) {
    const doc = await this.collection.doc(id).get();
    return doc.exists ? fromDoc(doc) : null;
  }

  /** filters: { field: value } (all equality); returns at most `limit` documents. */
  async listWhere(filters, limit = 500) {
    let query = this.collection;
    for (const [field, value] of Object.entries(filters)) query = query.where(field, '==', value);
    const snap = await query.limit(limit).get();
    return snap.docs.map(fromDoc);
  }

  async listAll(limit = 500) {
    const snap = await this.collection.limit(limit).get();
    return snap.docs.map(fromDoc);
  }

  async update(id, fields) {
    const ref = this.collection.doc(id);
    await ref.update({ ...fields, updated_at: Timestamp.now() });
    return fromDoc(await ref.get());
  }

  /**
   * Read-check-write in a transaction: `mutate(current)` returns the fields to update or throws.
   * Prevents two concurrent status changes from both succeeding.
   */
  async transition(id, mutate) {
    const ref = this.collection.doc(id);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const current = fromDoc(snap);
      const fields = { ...mutate(current), updated_at: Timestamp.now() };
      tx.update(ref, fields);
      return { ...current, ...fields };
    });
  }
}

module.exports = SimpleRepository;
