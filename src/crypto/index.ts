/**
 * AES-GCM encryption for Belanjaku Plugin internal GraphQL requests.
 *
 * Secret  = SHA-256(tenantDomain + ":" + runtimeKey)
 * Cipher  = AES-GCM, IV = 12 random bytes, tagLength = 128 bit
 * Output  = Base64( IV + AuthTag + Ciphertext )
 *
 * This format is decrypted server-side by
 * swift-page `core/modules/plugin/helpers/decryptPluginVariables.js` — do
 * not change the byte layout without updating both sides.
 */

function getTextEncoder(): TextEncoder {
  // Constructed lazily so merely *importing* this module doesn't throw in a
  // non-browser environment (e.g. during SSR, before createPlugin's own
  // `typeof window !== 'undefined'` guard has a chance to matter).
  return new TextEncoder();
}

function assertWebCrypto(): void {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error(
      '[PluginSDK] window.crypto.subtle is unavailable. encryptVariables() requires a ' +
        'secure context (HTTPS or localhost) and a browser environment — it cannot run ' +
        'during SSR or over plain HTTP.'
    );
  }
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const hash = await window.crypto.subtle.digest('SHA-256', getTextEncoder().encode(secret));

  return window.crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt']);
}

/**
 * Encrypt GraphQL variables for the Belanjaku internal GraphQL proxy.
 *
 * @param variables  Plain variables object
 * @param tenantDomain  e.g. "belanjaku.id"
 * @param runtimeKey  e.g. "ReviewWidget"
 * @returns Base64 string of IV + AuthTag + Ciphertext
 */
export async function encryptVariables(
  variables: Record<string, unknown>,
  tenantDomain: string,
  runtimeKey: string
): Promise<string> {
  if (!tenantDomain) throw new Error('[PluginSDK] tenantDomain is required for encryption');
  if (!runtimeKey) throw new Error('[PluginSDK] runtimeKey is required for encryption');

  assertWebCrypto();

  const secret = `${tenantDomain}:${runtimeKey}`;
  const key = await deriveKey(secret);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = getTextEncoder().encode(JSON.stringify(variables));

  const encrypted = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, encoded);

  const encryptedBytes = new Uint8Array(encrypted);
  const AUTH_TAG_LEN = 16;

  // Web Crypto appends the auth tag at the END of the ciphertext buffer
  const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - AUTH_TAG_LEN);
  const authTag = encryptedBytes.slice(encryptedBytes.length - AUTH_TAG_LEN);

  // Pack: IV | AuthTag | Ciphertext
  const result = new Uint8Array(iv.length + authTag.length + ciphertext.length);
  result.set(iv, 0);
  result.set(authTag, iv.length);
  result.set(ciphertext, iv.length + authTag.length);

  return bufferToBase64(result.buffer);
}
