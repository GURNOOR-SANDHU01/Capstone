const { db, Timestamp, COLLECTIONS } = require('../config/firebase/firestore');
const { pagedQuery } = require('./indexedQuery');

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
    const { items: logs, hasMore } = await pagedQuery({
      collection: this.collection,
      equality: { user_id: userId, provider: provider || undefined },
      orderBy: { field: 'sync_timestamp', direction: 'desc' },
      page,
      limit,
      label: 'biometric_sync_logs.listLogsForUser'
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
