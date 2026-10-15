const { db, Timestamp, COLLECTIONS } = require('../config/firebase/firestore');
const { fromDoc } = require('../utils/docNormalizer');

class ConsentRepository {
  constructor() {
    this.bridgesCollection = db.collection(COLLECTIONS.THERAPIST_BRIDGES);
    this.auditCollection = db.collection(COLLECTIONS.CONSENT_AUDIT);
  }

  async grantConsent(userId, data, meta = {}) {
    const now = Timestamp.now();
    const batch = db.batch();

    // 1. Check if bridge already exists for this pair
    const snap = await this.bridgesCollection
      .where('user_id', '==', userId)
      .where('therapist_id', '==', data.therapist_id)
      .limit(1)
      .get();

    let bridgeRef;
    const bridgeData = {
      user_id: userId,
      therapist_id: data.therapist_id,
      consent_granted: true,
      consent_updated_at: now,
      access_level: data.access_level || 'longitudinal_summary_only',
      red_flag_alerts_enabled: data.red_flag_alerts_enabled ?? true
    };

    if (!snap.empty) {
      bridgeRef = snap.docs[0].ref;
      batch.update(bridgeRef, bridgeData);
    } else {
      bridgeRef = this.bridgesCollection.doc();
      batch.set(bridgeRef, bridgeData);
    }

    // 2. Add immutable audit log
    const auditRef = this.auditCollection.doc();
    const auditData = {
      user_id: userId,
      consent_type: 'therapist_access',
      action: 'granted',
      action_timestamp: now,
      feature_affected: data.feature_affected || 'therapist_longitudinal_view',
      access_level: data.access_level || 'longitudinal_summary_only',
      metadata: {
        therapist_id: data.therapist_id,
        ip_address: meta.ip || 'unknown',
        user_agent: meta.userAgent || 'unknown'
      }
    };
    batch.set(auditRef, auditData);

    await batch.commit();

    return {
      bridge: { id: bridgeRef.id, ...bridgeData },
      auditLogId: auditRef.id
    };
  }

  async revokeConsent(userId, data, meta = {}) {
    const now = Timestamp.now();
    const batch = db.batch();

    const snap = await this.bridgesCollection
      .where('user_id', '==', userId)
      .where('therapist_id', '==', data.therapist_id)
      .limit(1)
      .get();

    if (snap.empty) {
      return { notFound: true };
    }

    const bridgeRef = snap.docs[0].ref;
    const currentBridge = snap.docs[0].data();

    batch.update(bridgeRef, {
      consent_granted: false,
      consent_updated_at: now
    });

    const auditRef = this.auditCollection.doc();
    const auditData = {
      user_id: userId,
      consent_type: 'therapist_access',
      action: 'revoked',
      action_timestamp: now,
      feature_affected: data.feature_affected || 'therapist_longitudinal_view',
      access_level: currentBridge.access_level || 'none',
      metadata: {
        therapist_id: data.therapist_id,
        ip_address: meta.ip || 'unknown',
        user_agent: meta.userAgent || 'unknown'
      }
    };
    batch.set(auditRef, auditData);

    await batch.commit();

    return {
      bridgeId: bridgeRef.id,
      status: 'revoked',
      auditLogId: auditRef.id
    };
  }

  async listUserBridges(userId) {
    const snap = await this.bridgesCollection.where('user_id', '==', userId).get();
    const bridges = [];
    snap.forEach((doc) => {
      bridges.push(fromDoc(doc));
    });
    return bridges;
  }

  /**
   * Returns the active (consent_granted) bridge between a patient and a doctor, or null.
   */
  async findActiveBridge(userId, therapistId) {
    const snap = await this.bridgesCollection
      .where('therapist_id', '==', therapistId)
      .where('user_id', '==', userId)
      .where('consent_granted', '==', true)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return fromDoc(snap.docs[0]);
  }

  async listActiveBridgesForTherapist(therapistId) {
    const snap = await this.bridgesCollection
      .where('therapist_id', '==', therapistId)
      .where('consent_granted', '==', true)
      .get();
    const bridges = [];
    snap.forEach((doc) => {
      bridges.push(fromDoc(doc));
    });
    return bridges;
  }

  async listAuditLogs(userId) {
    const snap = await this.auditCollection
      .where('user_id', '==', userId)
      .orderBy('action_timestamp', 'desc')
      .limit(50)
      .get();

    const logs = [];
    snap.forEach((doc) => {
      logs.push(fromDoc(doc));
    });
    return logs;
  }
}

module.exports = new ConsentRepository();
