const { db, Timestamp, COLLECTIONS } = require('../config/firebase/firestore');
const { fromDoc } = require('../utils/docNormalizer');

class MemoryRepository {
  constructor() {
    this.memoriesCollection = db.collection(COLLECTIONS.MEMORIES);
    this.feedbackCollection = db.collection(COLLECTIONS.MEMORY_FEEDBACK);
  }

  async create(userId, data) {
    const now = Timestamp.now();
    const memory = {
      user_id: userId,
      memory_text: data.memory_text,
      memory_type: data.memory_type,
      importance_score: data.importance_score ?? 0.5,
      created_at: now,
      updated_at: now,
      metadata: {
        associated_entry_id: data.metadata?.associated_entry_id || '',
        extraction_confidence: data.metadata?.extraction_confidence ?? 0.5
      }
    };

    const docRef = await this.memoriesCollection.add(memory);
    return { id: docRef.id, ...memory };
  }

  async getById(id) {
    const doc = await this.memoriesCollection.doc(id).get();
    if (!doc.exists) return null;
    return fromDoc(doc);
  }

  async listByUser(userId, { memory_type, min_importance, page = 1, limit = 20 }) {
    let query = this.memoriesCollection.where('user_id', '==', userId);

    if (memory_type) {
      query = query.where('memory_type', '==', memory_type);
    }
    if (min_importance !== undefined) {
      query = query.where('importance_score', '>=', min_importance);
    }

    query = query.orderBy('created_at', 'desc');

    const offset = (page - 1) * limit;
    const snapshot = await query.limit(limit + 1).offset(offset).get();

    const items = [];
    const hasMore = snapshot.docs.length > limit;
    const docs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;

    docs.forEach((doc) => {
      items.push(fromDoc(doc));
    });

    return {
      memories: items,
      pagination: {
        page,
        limit,
        hasMore,
        count: items.length
      }
    };
  }

  async addFeedback(memoryId, userId, feedbackData) {
    const memoryRef = this.memoriesCollection.doc(memoryId);
    const memoryDoc = await memoryRef.get();

    if (!memoryDoc.exists) {
      return { notFound: true };
    }
    if (memoryDoc.data().user_id !== userId) {
      return { forbidden: true };
    }

    const now = Timestamp.now();
    let confidenceBoost = 0;
    let isAccurate = feedbackData.is_accurate;

    if (feedbackData.user_feedback === 'agree') {
      confidenceBoost = 0.05;
      if (isAccurate === undefined) isAccurate = true;
    } else if (feedbackData.user_feedback === 'disagree') {
      confidenceBoost = -0.05;
      if (isAccurate === undefined) isAccurate = false;
    }

    const feedbackDoc = {
      user_id: userId,
      memory_id: memoryId,
      memory_text: memoryDoc.data().memory_text,
      user_feedback: feedbackData.user_feedback,
      feedback_timestamp: now,
      confidence_boost: confidenceBoost,
      is_accurate: isAccurate ?? true,
      user_notes: feedbackData.user_notes || null
    };

    const feedbackRef = await this.feedbackCollection.add(feedbackDoc);

    // Adjust memory importance score within [0, 1] range
    const currentScore = memoryDoc.data().importance_score || 0.5;
    const updatedScore = Math.min(1.0, Math.max(0.0, currentScore + confidenceBoost));

    await memoryRef.update({
      importance_score: updatedScore,
      updated_at: now
    });

    return {
      feedback: { id: feedbackRef.id, ...feedbackDoc },
      updatedImportanceScore: updatedScore
    };
  }
}

module.exports = new MemoryRepository();
