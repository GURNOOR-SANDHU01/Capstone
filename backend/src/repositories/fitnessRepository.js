const { db, Timestamp, COLLECTIONS } = require('../config/firebase/firestore');
const { fromDoc } = require('../utils/docNormalizer');

/**
 * fitness_connections/{uid}        one per user; `encrypted_refresh_token` is AES-256-GCM ciphertext
 * fitness_daily_metrics/{uid_date} one per user per local day
 * Queries are equality-only (no composite index needed); date filtering/sorting is in memory.
 */
class FitnessRepository {
  constructor() {
    this.connections = db.collection(COLLECTIONS.FITNESS_CONNECTIONS);
    this.metrics = db.collection(COLLECTIONS.FITNESS_DAILY_METRICS);
  }

  async getConnection(uid) {
    const snap = await this.connections.doc(uid).get();
    return snap.exists ? fromDoc(snap) : null;
  }

  async saveConnection(uid, fields) {
    const current = (await this.getConnection(uid)) || {};
    delete current.id;
    const doc = { ...current, ...fields, user_id: uid, updated_at: Timestamp.now() };
    await this.connections.doc(uid).set(doc);
    return doc;
  }

  /** Connections eligible for background sync. */
  async listConnected(limit = 500) {
    const snap = await this.connections.where('status', '==', 'connected').limit(limit).get();
    return snap.docs.map(fromDoc);
  }

  async deleteConnection(uid) {
    await this.connections.doc(uid).delete();
  }

  async upsertDays(uid, provider, days) {
    const now = Timestamp.now();
    await Promise.all(
      days.map((d) =>
        this.metrics.doc(`${uid}_${d.date}`).set({ ...d, user_id: uid, provider, synced_at: now })
      )
    );
  }

  /** Days with from <= date <= to (YYYY-MM-DD strings compare correctly), oldest first. */
  async listDays(uid, from, to) {
    const snap = await this.metrics.where('user_id', '==', uid).limit(1000).get();
    return snap.docs
      .map(fromDoc)
      .filter((d) => d.date >= from && d.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async deleteAllDays(uid) {
    const snap = await this.metrics.where('user_id', '==', uid).limit(1000).get();
    await Promise.all(snap.docs.map((d) => this.metrics.doc(d.id).delete()));
    return snap.docs.length;
  }
}

module.exports = new FitnessRepository();
