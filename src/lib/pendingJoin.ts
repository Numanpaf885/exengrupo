/** A join code from a link opened while signed out; used right after login. */
let pending: string | null = null;

export const setPendingJoin = (code: string | null): void => {
  pending = code;
};

export const takePendingJoin = (): string | null => {
  const code = pending;
  pending = null;
  return code;
};
