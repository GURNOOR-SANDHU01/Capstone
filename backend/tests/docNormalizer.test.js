/**
 * Read-side normalization of the malformed shapes found in the live demo data
 * (see docs/data-reconciliation-plan.md, anomalies A4–A10).
 */
const { normalizeData } = require('../src/utils/docNormalizer');

const ts = { toDate: () => new Date('2026-01-01'), seconds: 1 };

describe('docNormalizer', () => {
  it('moves whitespace-padded keys to their trimmed names (A5–A8)', () => {
    const out = normalizeData({
      'metadata ': { associated_entry_id: 'e1', extraction_confidence: 0.8 },
      preferences: { 'theme ': 'light', cbt_alignment: true }
    });
    expect(out.metadata).toEqual({ associated_entry_id: 'e1', extraction_confidence: 0.8 });
    expect(out['metadata ']).toBeUndefined();
    expect(out.preferences.theme).toBe('light');
    expect(out.preferences['theme ']).toBeUndefined();
  });

  it('keeps the canonical key when both padded and canonical keys exist', () => {
    expect(normalizeData({ data_synced: { metrics_count: 2 }, 'data_synced ': { metrics_count: 9 } })).toEqual({
      data_synced: { metrics_count: 2 }
    });
  });

  it('recovers safety flags stored under sync_timestamp (A9)', () => {
    const out = normalizeData({
      sync_timestamp: { severity_flag: 'high', red_zone_triggered: true, crisis_language_detected: false }
    });
    expect(out.safety_flags.severity_flag).toBe('high');
    expect(out.sync_timestamp).toBeUndefined();
  });

  it('does not touch a real sync_timestamp Timestamp or existing safety_flags', () => {
    const out = normalizeData({ sync_timestamp: ts, safety_flags: { severity_flag: 'normal' } });
    expect(out.sync_timestamp).toBe(ts);
    expect(out.safety_flags.severity_flag).toBe('normal');
  });

  it('recovers nested detected_emotions scores as all_28_states (A10)', () => {
    const out = normalizeData({ detected_emotions: { primary_state: 'anxiety', detected_emotions: { anxiety: 0.8 } } });
    expect(out.detected_emotions.all_28_states).toEqual({ anxiety: 0.8 });
    expect(out.detected_emotions.detected_emotions).toBeUndefined();
  });

  it('lifts structured_memory out of preferences (A4)', () => {
    const out = normalizeData({ preferences: { theme: 'dark', structured_memory: { sleep_goal: '7 hours' } } });
    expect(out.structured_memory).toEqual({ sleep_goal: '7 hours' });
    expect(out.preferences.structured_memory).toBeUndefined();
  });

  it('preserves Timestamps, arrays and already-correct documents', () => {
    const doc = { created_at: ts, extracted_themes: ['work'], detected_emotions: { all_28_states: { joy: 1 } } };
    expect(normalizeData(doc)).toEqual(doc);
    expect(normalizeData(doc).created_at).toBe(ts);
  });
});
