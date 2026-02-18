const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

export async function managementFetch<T = unknown>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: object
): Promise<T> {
  const key = process.env.OPENROUTER_MANAGEMENT_KEY;
  if (!key) throw new Error('OPENROUTER_MANAGEMENT_KEY is not set');

  const res = await fetch(`${OPENROUTER_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenRouter Management API ${method} ${path} → ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}
