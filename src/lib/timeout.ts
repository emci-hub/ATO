/**
 * Wraps a promise with a timeout. If the promise doesn't settle in `ms`, it
 * rejects with a descriptive error. React Native's fetch has no default
 * timeout, so a dropped connection would otherwise hang the UI forever.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'request'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
