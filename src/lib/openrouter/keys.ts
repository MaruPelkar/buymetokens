import { managementFetch } from './client';

interface CreateKeyResponse {
  key: string;
  data: {
    hash: string;
    label: string;
    limit: number | null;
    limit_remaining: number | null;
    usage: number;
    disabled: boolean;
    created_at: string;
  };
}

interface KeyStatusResponse {
  data: {
    hash: string;
    disabled: boolean;
    limit: number | null;
    limit_remaining: number | null;
    usage: number;
    usage_daily?: number;
    usage_weekly?: number;
    usage_monthly?: number;
  };
}

/** Masks a key as 'sk-or-v1-a3f2...c123' */
function maskKey(plaintext: string): string {
  if (plaintext.length <= 16) return plaintext;
  return `${plaintext.slice(0, 12)}...${plaintext.slice(-4)}`;
}

/**
 * Provisions a new OpenRouter key with a $0 spending limit.
 * Returns the plaintext key (shown to developer once — never stored).
 */
export async function createProvisionedKey(
  keyName: string
): Promise<{ plaintext: string; hash: string; prefix: string }> {
  const resp = await managementFetch<CreateKeyResponse>('POST', '/keys', {
    name: keyName,
    limit: 0,
    limit_reset: null,
  });

  return {
    plaintext: resp.key,
    hash: resp.data.hash,
    prefix: maskKey(resp.key),
  };
}

/**
 * Updates the spending limit on an existing key to match the developer's current balance.
 */
export async function updateKeyLimit(hash: string, limitUsd: number): Promise<void> {
  await managementFetch('PATCH', `/keys/${hash}`, {
    limit: parseFloat(limitUsd.toFixed(4)),
  });
}

/**
 * Disables a key immediately. Developer can create a replacement.
 */
export async function disableKey(hash: string): Promise<void> {
  await managementFetch('PATCH', `/keys/${hash}`, { disabled: true });
}

/**
 * Reads the current status of a key (for usage sync).
 */
export async function getKeyStatus(
  hash: string
): Promise<{ limit_remaining: number; usage: number; disabled: boolean }> {
  const resp = await managementFetch<KeyStatusResponse>('GET', `/keys/${hash}`);
  return {
    limit_remaining: resp.data.limit_remaining ?? 0,
    usage: resp.data.usage ?? 0,
    disabled: resp.data.disabled,
  };
}
