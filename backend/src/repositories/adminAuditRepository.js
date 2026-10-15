const { db, Timestamp, COLLECTIONS } = require('../config/firebase/firestore');
const { fromDoc } = require('../utils/docNormalizer');

/**
 * Append-only log of privileged administrative actions (role changes, doctor profile edits, ...).
 */
class AdminAuditRepository {
  constructor() {
    this.collection = db.collection(COLLECTIONS.ADMIN_AUDIT);
  }

  async log({ actorId, actorRole, action, targetId, details = {} }) {
    const entry = {
      actor_id: actorId,
      actor_role: actorRole,
      action,
      target_id: targetId || null,
      details,
      timestamp: Timestamp.now()
    };
    const ref = await this.collection.add(entry);
    return { id: ref.id, ...entry };
  }

  async list(limit = 100) {
    const snap = await this.collection.orderBy('timestamp', 'desc').limit(limit).get();
    return snap.docs.map((doc) => (fromDoc(doc)));
  }
}

module.exports = new AdminAuditRepository();
