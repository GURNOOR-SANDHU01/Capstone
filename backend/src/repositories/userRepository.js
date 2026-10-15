const { db, Timestamp, COLLECTIONS } = require('../config/firebase/firestore');
const { fromDoc } = require('../utils/docNormalizer');
const logger = require('../utils/logger');

class UserRepository {
  constructor() {
    this.collection = db.collection(COLLECTIONS.USERS);
  }

  async getById(uid) {
    const doc = await this.collection.doc(uid).get();
    if (!doc.exists) {
      return null;
    }
    return fromDoc(doc);
  }

  /**
   * Batch profile lookup. Returns { [uid]: profile } for the IDs that exist.
   */
  async getManyByIds(uids) {
    const unique = [...new Set(uids.filter(Boolean))];
    const docs = await Promise.all(unique.map((uid) => this.collection.doc(uid).get()));
    const result = {};
    docs.forEach((doc) => {
      if (doc.exists) result[doc.id] = fromDoc(doc);
    });
    return result;
  }

  async listByRole(role, limit = 100) {
    const snap = await this.collection.where('role', '==', role).limit(limit).get();
    return snap.docs.map((doc) => (fromDoc(doc)));
  }

  async list(limit = 200) {
    const snap = await this.collection.limit(limit).get();
    return snap.docs.map((doc) => (fromDoc(doc)));
  }

  /**
   * Writes top-level fields on an existing profile (server-controlled fields such as the role
   * mirror or onboarding state). Returns null when the profile does not exist.
   */
  async setFields(uid, fields) {
    const docRef = this.collection.doc(uid);
    const existing = await docRef.get();
    if (!existing.exists) return null;
    await docRef.update({ ...fields, updated_at: Timestamp.now() });
    const updated = await docRef.get();
    return fromDoc(updated);
  }

  async create(uid, data) {
    const now = Timestamp.now();
    const userDoc = {
      full_name: data.full_name || '',
      email: data.email || '',
      // Display mirror only; the authoritative role is the Firebase custom claim
      role: data.role || 'patient',
      created_at: now,
      updated_at: now,
      preferences: {
        theme: data.preferences?.theme || 'dark',
        cbt_alignment: data.preferences?.cbt_alignment ?? true,
        daily_reminder_time: data.preferences?.daily_reminder_time || '08:00',
        emergency_contacts: data.preferences?.emergency_contacts || []
      },
      structured_memory: {
        sleep_goal: data.structured_memory?.sleep_goal || '8 hours',
        preferred_coping_strategies: data.structured_memory?.preferred_coping_strategies || ['deep_breathing', 'journaling']
      },
      resilience_streaks: {
        current_streak: data.resilience_streaks?.current_streak || 1,
        longest_streak: data.resilience_streaks?.longest_streak || 1,
        last_check_in: now
      }
    };

    try {
      // create() fails if the profile already exists, so concurrent first requests
      // (e.g. sign-up and the auth listener) can never overwrite each other's data
      await this.collection.doc(uid).create(userDoc);
    } catch (err) {
      if (err.code === 6 || err.code === 'already-exists') return this.getById(uid);
      throw err;
    }
    return { id: uid, ...userDoc };
  }

  async update(uid, data) {
    const docRef = this.collection.doc(uid);
    const existing = await docRef.get();
    if (!existing.exists) {
      return null;
    }

    const updates = {
      updated_at: Timestamp.now()
    };

    if (data.full_name !== undefined) updates.full_name = data.full_name;
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.language !== undefined) updates.language = data.language;

    if (data.preferences) {
      const current = existing.data().preferences || {};
      updates.preferences = { ...current, ...data.preferences };
    }

    if (data.structured_memory) {
      const current = existing.data().structured_memory || {};
      updates.structured_memory = { ...current, ...data.structured_memory };
    }

    if (data.resilience_streaks) {
      const current = existing.data().resilience_streaks || {};
      updates.resilience_streaks = { ...current, ...data.resilience_streaks };
    }

    await docRef.update(updates);
    const updated = await docRef.get();
    return fromDoc(updated);
  }

  /**
   * Complete account deletion workflow:
   * Deletes the user profile and purges/anonymizes user-owned documents across collections.
   */
  async deleteAccount(uid) {
    const batch = db.batch();

    // 1. User doc
    const userRef = this.collection.doc(uid);
    batch.delete(userRef);

    // 2. Fetch and delete user-owned collections in batches
    const collectionsToPurge = [
      COLLECTIONS.JOURNAL_ENTRIES,
      COLLECTIONS.MEMORIES,
      COLLECTIONS.REFLECTION_PROMPTS,
      COLLECTIONS.RED_FLAG_ALERTS,
      COLLECTIONS.THERAPIST_BRIDGES,
      COLLECTIONS.CONSENT_AUDIT,
      COLLECTIONS.BIOMETRIC_SYNC,
      COLLECTIONS.MEMORY_FEEDBACK
    ];

    let totalDeleted = 0;
    for (const collName of collectionsToPurge) {
      const snap = await db.collection(collName).where('user_id', '==', uid).get();
      snap.forEach((doc) => {
        batch.delete(doc.ref);
        totalDeleted++;
      });
    }

    await batch.commit();
    logger.info(`User account ${uid} and ${totalDeleted} related documents permanently deleted.`);
    return { success: true, deletedRecords: totalDeleted };
  }
}

module.exports = new UserRepository();
