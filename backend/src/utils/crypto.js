/**
 * Encryption at rest for third-party OAuth tokens, and signed OAuth `state` values.
 *
 * - encrypt/decrypt: AES-256-GCM (authenticated). Output "v1.<iv>.<tag>.<ciphertext>" (base64url).
 *   Key: TOKEN_ENCRYPTION_KEY = 32 random bytes, base64 (generate with
 *   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).
 * - signState/verifyState: HMAC-SHA256 over a JSON payload with an expiry, so the OAuth
 *   callback (a browser redirect without our bearer token) can trust which user started it.
 *   The HMAC key is derived from the encryption key, never the key itself.
 */
const crypto = require('crypto');
const config = require('../config/env');

const VERSION = 'v1';
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const fromB64u = (s) => Buffer.from(s, 'base64url');

function getKey() {
  const raw = config.security.tokenEncryptionKey;
  if (!raw) return null;
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes encoded as base64');
  }
  return key;
}

const isEncryptionConfigured = () => {
  try {
    return getKey() !== null;
  } catch {
    return false;
  }
};

function requireKey() {
  const key = getKey();
  if (!key) throw new Error('TOKEN_ENCRYPTION_KEY is not configured');
  return key;
}

function encrypt(plaintext, aad = '') {
  const key = requireKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  if (aad) cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return [VERSION, b64u(iv), b64u(cipher.getAuthTag()), b64u(ct)].join('.');
}

/** `aad` binds the ciphertext to its owner (e.g. the uid), so a token copied to another user's record fails. */
function decrypt(payload, aad = '') {
  const key = requireKey();
  const [version, iv, tag, ct] = String(payload).split('.');
  if (version !== VERSION || !iv || !tag || !ct) throw new Error('Unsupported ciphertext format');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, fromB64u(iv));
  if (aad) decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(fromB64u(tag));
  return Buffer.concat([decipher.update(fromB64u(ct)), decipher.final()]).toString('utf8');
}

const hmacKey = () => crypto.createHmac('sha256', requireKey()).update('sentimed-oauth-state').digest();

function signState(payload, ttlSeconds = 600) {
  const body = b64u(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  const sig = b64u(crypto.createHmac('sha256', hmacKey()).update(body).digest());
  return `${body}.${sig}`;
}

/** Returns the payload, or null if the signature is wrong or it has expired. */
function verifyState(state) {
  if (typeof state !== 'string' || state.length > 2048) return null;
  const [body, sig] = state.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', hmacKey()).update(body).digest();
  const given = fromB64u(sig);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(fromB64u(body).toString('utf8'));
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

const randomToken = (bytes = 16) => crypto.randomBytes(bytes).toString('base64url');

module.exports = { encrypt, decrypt, signState, verifyState, randomToken, isEncryptionConfigured };
