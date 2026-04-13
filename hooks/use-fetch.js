import { useState, useCallback } from "react";
import { toast } from "sonner";

/**
 * Generic hook for calling server actions (or any async function) from
 * client components.
 *
 * Returns a stable `fn` reference (via useCallback) so it can safely be
 * listed in useEffect dependency arrays without causing infinite loops.
 *
 * Shape returned:
 *   { data, loading, error, fn, setData }
 *
 * `error` is the raw Error object (or whatever was thrown); the hook also
 * surfaces a toast automatically so callers don't have to repeat that logic.
 */
const useFetch = (cb) => {
  const [data, setData] = useState(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fn = useCallback(
    async (...args) => {
      setLoading(true);
      setError(null);

      try {
        const response = await cb(...args);
        setData(response);
        setError(null);
        return response;
      } catch (err) {
        setError(err);
        toast.error(err?.message ?? "Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    // cb is expected to be stable (server action references are module-level
    // constants), so this dependency is safe.
    [cb]
  );

  return { data, loading, error, fn, setData };
};

export default useFetch;
