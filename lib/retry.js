/**
 * Run an async operation again when it fails with a transient error.
 *
 * @param {(attempt: number) => Promise<T>} operation
 * @param {object} options
 * @param {number} options.attempts - total number of attempts (1 = no retry)
 * @param {number} options.delayMs - delay before the first retry, doubled after every attempt
 * @param {(error: Error) => boolean} options.shouldRetry - decides whether an error is worth a retry
 * @param {(error: Error, attempt: number, delayMs: number) => void} [options.onRetry] - called before each retry
 * @returns {Promise<T>} the result of the first successful attempt; throws the last error otherwise
 * @template T
 */
export async function withRetry(operation, { attempts, delayMs, shouldRetry, onRetry }) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt >= attempts || !shouldRetry(error)) {
        throw error;
      }
      const delay = delayMs * 2 ** (attempt - 1);
      if (onRetry) {
        onRetry(error, attempt, delay);
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Transient API errors: no response at all (timeout, connection reset, DNS),
 * HTTP 429 and HTTP 5xx. A 4xx answer is final and is never retried.
 */
export function isTransientApiError(error) {
  const status = error?.response?.status;
  if (status) {
    return status === 429 || status >= 500;
  }
  return Boolean(error?.isAxiosError || error?.code);
}
