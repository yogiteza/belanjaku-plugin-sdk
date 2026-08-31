import { createHash, createDecipheriv } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { encryptVariables } from '../crypto';

/**
 * Decrypts using the *exact* algorithm swift-page runs server-side, in
 * core/modules/plugin/helpers/decryptPluginVariables.js. This test exists so
 * a change to the wire format on either side shows up here, not in
 * production — the SDK and the host must never drift apart on this.
 */
function decryptLikeHost(encrypted: string, secret: string): unknown {
  const raw = Buffer.from(encrypted, 'base64');
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  const key = createHash('sha256').update(secret).digest();
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

describe('encryptVariables', () => {
  it('round-trips through the host decryptor', async () => {
    const variables = { runtime_key: 'ReviewWidget', scope_key: 'SKU-123', nested: { a: 1, b: [1, 2, 3] } };
    const tenantDomain = 'belanjaku.id';
    const runtimeKey = 'ReviewWidget';

    const encrypted = await encryptVariables(variables, tenantDomain, runtimeKey);
    const decrypted = decryptLikeHost(encrypted, `${tenantDomain}:${runtimeKey}`);

    expect(decrypted).toEqual(variables);
  });

  it('produces a different ciphertext each call (random IV)', async () => {
    const a = await encryptVariables({ x: 1 }, 'belanjaku.id', 'ReviewWidget');
    const b = await encryptVariables({ x: 1 }, 'belanjaku.id', 'ReviewWidget');
    expect(a).not.toBe(b);
  });

  it('fails to decrypt with the wrong secret (auth tag mismatch)', async () => {
    const encrypted = await encryptVariables({ x: 1 }, 'belanjaku.id', 'ReviewWidget');
    expect(() => decryptLikeHost(encrypted, 'wrong.domain:ReviewWidget')).toThrow();
  });

  it('throws without tenantDomain or runtimeKey', async () => {
    await expect(encryptVariables({ x: 1 }, '', 'ReviewWidget')).rejects.toThrow('tenantDomain is required');
    await expect(encryptVariables({ x: 1 }, 'belanjaku.id', '')).rejects.toThrow('runtimeKey is required');
  });
});
