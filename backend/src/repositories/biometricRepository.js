const { db, Timestamp, COLLECTIONS } = require('../config/firebase/firestore');
const { fromDoc } = require('../utils/docNormalizer');

class BiometricRepository {
  constructor() {
    this.collection = db.collection(COLLECTIONS.BIOMETRIC_SYNC);
  }

  async createSyncLog(userId, data) {
    const now = Timestamp.now();
    const log = {
      user_id: userId,
      sync_timestamp: now,
      provider: data.provider,
      status: data.status || 'success',
      error_message: data.error_message || null,
      next_retry_at: data.next_retry_at || null,
      data_synced: data.data_synced || null
    };

    const docRef = await this.collection.add(log);
    return { id: docRef.id, ...log };
  }

  async listLogsForUser(userId, { provider, page = 1, limit = 20 }) {
    let query = this.collection.where('user_id', '==', userId);

    if (provider) {
      query = query.where('provider', '==', provider);
    }

    query = query.orderBy('sync_timestamp', 'desc');

    const offset = (page - 1) * limit;
    const snap = await query.limit(limit + 1).offset(offset).get();

    const logs = [];
    const hasMore = snap.docs.length > limit;
    const docs = hasMore ? snap.docs.slice(0, limit) : snap.docs;

    docs.forEach((doc) => {
      logs.push(fromDoc(doc));
    });

    return {
      logs,
      pagination: {
        page,
        limit,
        hasMore,
        count: logs.length
      }
    };
  }
}

module.exports = new BiometricRepository();
