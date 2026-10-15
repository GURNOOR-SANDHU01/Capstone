import { useState, useEffect, useCallback } from 'react';
import {
  listJournalEntries,
  addJournalEntry,
  removeJournalEntry,
  setJournalEntryVisibility,
  editJournalEntry
} from '../services/journalService';
import { describeError } from '../services/apiClient';

/**
 * Journal state for the signed-in patient. Loads from the backend (live) or localStorage
 * (sandbox), and updates local state from each successful server response, so the UI never
 * shows data that was not persisted.
 */
export function useJournal(currentUser) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const uid = currentUser?.uid;
  const isPatient = currentUser?.role === 'patient';

  const reload = useCallback(async () => {
    if (!uid || !isPatient) {
      setEntries([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setEntries(await listJournalEntries());
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  }, [uid, isPatient]);

  useEffect(() => {
    reload();
  }, [reload]);

  const addEntry = useCallback(async (data) => {
    const created = await addJournalEntry(data);
    setEntries((prev) => [created, ...prev.filter((e) => e.id !== created.id)]);
    return created;
  }, []);

  const removeEntry = useCallback(async (id) => {
    await removeJournalEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const setVisibility = useCallback(async (id, privacy) => {
    const updated = await setJournalEntryVisibility(id, privacy);
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...updated } : e)));
    return updated;
  }, []);

  const editEntry = useCallback(async (id, changes) => {
    const updated = await editJournalEntry(id, changes);
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...updated } : e)));
    return updated;
  }, []);

  return { entries, loading, error, reload, addEntry, removeEntry, setVisibility, editEntry };
}
