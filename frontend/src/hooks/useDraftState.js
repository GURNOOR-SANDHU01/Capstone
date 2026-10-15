import { useState, useCallback } from 'react';

/**
 * In-memory drafts that survive switching between screens (components unmount on navigation).
 * Deliberately not persisted to localStorage/sessionStorage: drafts can contain sensitive journal
 * text. They are cleared on sign-out (clearDrafts) and lost on a full page reload.
 *
 * The store is the source of truth, so an async result that arrives after the user navigated
 * away (e.g. a companion reply) is still kept and shown when they come back.
 */
const drafts = new Map();

export function clearDrafts() {
  drafts.clear();
}

/** Like useState, but the value is kept in the draft store under `key` until cleared. */
export function useDraftState(key, initialValue) {
  if (!drafts.has(key)) drafts.set(key, initialValue);
  const [value, setValue] = useState(() => drafts.get(key));

  const update = useCallback(
    (next) => {
      const resolved = typeof next === 'function' ? next(drafts.get(key)) : next;
      drafts.set(key, resolved);
      setValue(resolved);
    },
    [key]
  );

  return [value, update];
}
