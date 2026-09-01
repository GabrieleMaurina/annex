const BASE = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

export function httpGet<T>(path: string): Promise<T> {
  return fetch(BASE + path, { credentials: 'include' }).then((res) =>
    res.json(),
  );
}

export function httpSend<T>(
  method: 'POST' | 'PATCH',
  path: string,
  body: unknown,
): Promise<T> {
  return fetch(BASE + path, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  }).then((res) => res.json());
}
