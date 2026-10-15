import { useState, useEffect, useCallback, useRef } from 'react';
import { describeError } from '../services/apiClient';

/**
 * Loads data with an async function and tracks loading / error state.
 * `deps` re-run the loader (like useEffect deps). `setData` allows local updates
 * after a successful mutation, so lists refresh without a page reload.
 */
export function useAsyncData(loader, deps = [], initialData = null) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await loaderRef.current();
      setData(result);
      return result;
    } catch (err) {
      setError(describeError(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, setData, loading, error, reload };
}
