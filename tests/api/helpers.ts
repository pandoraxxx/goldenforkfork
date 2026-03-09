export function apiUrl(path: string): string {
  const base = process.env.TEST_API_BASE_URL || 'http://127.0.0.1:4100';
  return `${base}${path}`;
}

export async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path));
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function postJson<T>(path: string, body?: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? (JSON.parse(text) as T) : (undefined as T);
  return { status: res.status, data };
}

export async function patchJson<T>(path: string, body: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(apiUrl(path), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  const data = text ? (JSON.parse(text) as T) : (undefined as T);
  return { status: res.status, data };
}

export async function putJson<T>(path: string, body: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(apiUrl(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  const data = text ? (JSON.parse(text) as T) : (undefined as T);
  return { status: res.status, data };
}

export async function del(path: string): Promise<number> {
  const res = await fetch(apiUrl(path), { method: 'DELETE' });
  return res.status;
}
