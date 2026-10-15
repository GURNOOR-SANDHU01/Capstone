const { db, Timestamp, COLLECTIONS } = require('../config/firebase/firestore');
const { fromDoc } = require('../utils/docNormalizer');

class ReflectionRepository {
  constructor() {
    this.collection = db.collection(COLLECTIONS.REFLECTION_PROMPTS);
  }

  async create(userId, data) {
    const now = Timestamp.now();
    const doc = {
      user_id: userId,
      entry_id: data.entry_id || '',
      prompt_text: data.prompt_text,
      prompt_type: data.prompt_type || 'cbt_clarification',
      generated_at: now,
      user_response: null,
      user_response_timestamp: null,
      was_helpful: null,
      helpful_rating: null,
      cbt_technique_used: data.cbt_technique_used || 'cognitive_exploration'
    };

    const docRef = await this.collection.add(doc);
    return { id: docRef.id, ...doc };
  }

  async getById(id) {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    return fromDoc(doc);
  }

  async listByUser(userId, { entry_id, page = 1, limit = 20 }) {
    let query = this.collection.where('user_id', '==', userId);

    if (entry_id) {
      query = query.where('entry_id', '==', entry_id);
    }

    query = query.orderBy('generated_at', 'desc');

    const offset = (page - 1) * limit;
    const snapshot = await query.limit(limit + 1).offset(offset).get();

    const items = [];
    const hasMore = snapshot.docs.length > limit;
    const docs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

    docs.forEach((doc) => {
      items.push(fromDoc(doc));
    });

    return {
      prompts: items,
      pagination: {
        page,
        limit,
        hasMore,
        count: items.length
      }
    };
  }

  async updateResponse(id, userId, updates) {
    const docRef = this.collection.doc(id);
    const existing = await docRef.get();

    if (!existing.exists) {
      return { notFound: true };
    }
    if (existing.data().user_id !== userId) {
      return { forbidden: true };
    }

    const now = Timestamp.now();
    const payload = {};

    if (updates.user_response !== undefined) {
      payload.user_response = updates.user_response;
      payload.user_response_timestamp = now;
    }
    if (updates.was_helpful !== undefined) {
      payload.was_helpful = updates.was_helpful;
    }
    if (updates.helpful_rating !== undefined) {
      payload.helpful_rating = updates.helpful_rating;
    }

    await docRef.update(payload);
    const updated = await docRef.get();
    return { data: fromDoc(updated) };
  }
}

module.exports = new ReflectionRepository();
