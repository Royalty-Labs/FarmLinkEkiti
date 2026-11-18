import { useCallback, useEffect, useState } from "react";

type ApiState<T> = {
  fn?: unknown;
  nonce: number;
  data?: T;
  error?: string;
};

/**
 * Loads data from an async function and tracks loading/error state.
 * Pass a stable function (wrap it in useCallback); it reloads when the
 * function changes or when reload() is called.
 */
export function useApi<T>(fn: () => Promise<T>) {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<ApiState<T>>({ nonce: -1 });

  useEffect(() => {
    let active = true;
    fn()
      .then((data) => {
        if (active) setState({ fn, nonce, data });
      })
      .catch((error: unknown) => {
        if (active) {
          setState((previous) => ({
            fn,
            nonce,
            data: previous.data,
            error: error instanceof Error ? error.message : "Something went wrong.",
          }));
        }
      });
    return () => {
      active = false;
    };
  }, [fn, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const loading = state.fn !== fn || state.nonce !== nonce;

  return {
    data: state.data,
    error: loading ? undefined : state.error,
    loading,
    reload,
  };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
