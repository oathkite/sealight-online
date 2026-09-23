export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export const success = <T>(value: T): { readonly ok: true; readonly value: T } => ({ ok: true, value });

export const failure = <E>(error: E): { readonly ok: false; readonly error: E } => ({ ok: false, error });
