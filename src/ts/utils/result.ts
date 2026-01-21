export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type Option<T> = { some: true; value: T } | { some: false };

export const Ok = <T, E>(value: T): Result<T, E> => ({ ok: true, value });
export const Err = <T, E>(error: E): Result<T, E> => ({ ok: false, error });

export const Some = <T>(value: T): Option<T> => ({ some: true, value });
export const None = <T>(): Option<T> => ({ some: false });

/**
 * Helper to convert a promise to a Result.
 */
export async function toResult<T>(
  promise: Promise<T>,
): Promise<Result<T, Error>> {
  try {
    const value = await promise;
    return Ok(value);
  } catch (error) {
    return Err(error instanceof Error ? error : new Error(String(error)));
  }
}
