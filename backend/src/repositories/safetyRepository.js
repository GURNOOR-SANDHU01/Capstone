const { db, Timestamp, COLLECTIONS } = require('../config/firebase/firestore');
const { fromDoc } = require('../utils/docNormalizer');

class SafetyRepository {
  constructor() {
    this.collection = db.collection(COLLECTIONS.RED_FLAG_ALERTS);
  }

  async createAlert(data) {
    const now = Timestamp.now();
    const alert = {
      user_id: data.user_id,
      therapist_id: data.therapist_id || '',
      alert_type: data.alert_type || 'sustained_emotional_decline',
      severity: data.severity || 'moderate',
      triggered_at: now,
      trigger_reason: data.trigger_reason || 'Automated safety monitoring threshold exceeded',
      alert_status: 'pending',
      therapist_viewed_at: null,
      therapist_action_taken: null,
      action_timestamp: null,
      resolved_at: null
    };

    const docRef = await this.collection.add(alert);
    return { id: docRef.id, ...alert };
  }

  async getById(id) {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    return fromDoc(doc);
  }

  async listAlertsForUser(userId, { status, severity, page = 1, limit = 20 }) {
    let query = this.collection.where('user_id', '==', userId);

    if (status) query = query.where('alert_status', '==', status);
    if (severity) query = query.where('severity', '==', severity);

    query = query.orderBy('triggered_at', 'desc');

    const offset = (page - 1) * limit;
    const snap = await query.limit(limit + 1).offset(offset).get();

    const alerts = [];
    const hasMore = snap.docs.length > limit;
    const docs = hasMore ? snap.docs.slice(0, limit) : snap.docs;

    docs.forEach((doc) => {
      alerts.push(fromDoc(doc));
    });

    return {
      alerts,
      pagination: {
        page,
        limit,
        hasMore,
        count: alerts.length
      }
    };
  }

  async listAlertsForTherapist(therapistId, { status, severity, patient_id, page = 1, limit = 20 }) {
    let query = this.collection.where('therapist_id', '==', therapistId);

    if (patient_id) query = query.where('user_id', '==', patient_id);
    if (status) query = query.where('alert_status', '==', status);
    if (severity) query = query.where('severity', '==', severity);

    query = query.orderBy('triggered_at', 'desc');

    const offset = (page - 1) * limit;
    const snap = await query.limit(limit + 1).offset(offset).get();

    const alerts = [];
    const hasMore = snap.docs.length > limit;
    const docs = hasMore ? snap.docs.slice(0, limit) : snap.docs;

    docs.forEach((doc) => {
      alerts.push(fromDoc(doc));
    });

    return {
      alerts,
      pagination: {
        page,
        limit,
        hasMore,
        count: alerts.length
      }
    };
  }

  /**
   * Platform-wide alert list for admins (single-field index on triggered_at only).
   */
  async listAll({ page = 1, limit = 50 } = {}) {
    const offset = (page - 1) * limit;
    const snap = await this.collection.orderBy('triggered_at', 'desc').limit(limit + 1).offset(offset).get();
    const hasMore = snap.docs.length > limit;
    const docs = hasMore ? snap.docs.slice(0, limit) : snap.docs;
    return {
      alerts: docs.map((doc) => (fromDoc(doc))),
      pagination: { page, limit, hasMore, count: Math.min(docs.length, limit) }
    };
  }

  /**
   * Applies a status change. Authorization is decided by safetyService before calling this.
   */
  async applyStatusUpdate(id, existing, updates, actor) {
    const docRef = this.collection.doc(id);
    const now = Timestamp.now();
    const payload = {};

    if (updates.alert_status) {
      payload.alert_status = updates.alert_status;
      if (updates.alert_status === 'viewed' && !existing.therapist_viewed_at) {
        payload.therapist_viewed_at = now;
      }
      if (updates.alert_status === 'resolved') {
        payload.resolved_at = now;
      }
    }

    if (updates.therapist_action_taken !== undefined) {
      payload.therapist_action_taken = updates.therapist_action_taken;
      payload.action_timestamp = now;
    }
    payload.last_actor_id = actor.uid;
    payload.last_actor_role = actor.role;

    await docRef.update(payload);
    const updated = await docRef.get();
    return fromDoc(updated);
  }
}

module.exports = new SafetyRepository();
