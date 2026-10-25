// Shared async helpers used by the collection and tracklist fetchers.

export function abortError() {
  const err = new Error("Aborted");
  err.name = "AbortError";
  return err;
}

export class TimeoutError extends Error {
  constructor(message = "Request timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

export const isAbortError = (err) => err?.name === "AbortError";

// Cancellable sleep. Rejects with an AbortError if the signal is aborted,
// and always removes its abort listener so long fetches don't leak listeners.
export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(abortError());
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
