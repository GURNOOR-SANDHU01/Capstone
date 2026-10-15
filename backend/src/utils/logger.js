/**
 * Safe application logger that redacts sensitive information such as
 * auth tokens, raw journal content, private keys, and PII.
 */

const SENSITIVE_KEYS = new Set([
  'authorization',
  'token',
  'idtoken',
  'password',
  'secret',
  'private_key',
  'privatekey',
  'masked_content',
  'content',
  'user_response'
]);

function redact(obj, depth = 0) {
  if (depth > 5 || !obj) return obj;
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) return obj.map((item) => redact(item, depth + 1));
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, val] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof val === 'object' && val !== null) {
        sanitized[key] = redact(val, depth + 1);
      } else {
        sanitized[key] = val;
      }
    }
    return sanitized;
  }
  return obj;
}

const logger = {
  info: (message, meta) => {
    const timestamp = new Date().toISOString();
    if (meta) {
      console.log(`[${timestamp}] [INFO] ${message}`, JSON.stringify(redact(meta)));
    } else {
      console.log(`[${timestamp}] [INFO] ${message}`);
    }
  },
  warn: (message, meta) => {
    const timestamp = new Date().toISOString();
    if (meta) {
      console.warn(`[${timestamp}] [WARN] ${message}`, JSON.stringify(redact(meta)));
    } else {
      console.warn(`[${timestamp}] [WARN] ${message}`);
    }
  },
  error: (message, meta) => {
    const timestamp = new Date().toISOString();
    if (meta) {
      console.error(`[${timestamp}] [ERROR] ${message}`, JSON.stringify(redact(meta)));
    } else {
      console.error(`[${timestamp}] [ERROR] ${message}`);
    }
  },
  debug: (message, meta) => {
    if (process.env.NODE_ENV === 'production') return;
    const timestamp = new Date().toISOString();
    if (meta) {
      console.debug(`[${timestamp}] [DEBUG] ${message}`, JSON.stringify(redact(meta)));
    } else {
      console.debug(`[${timestamp}] [DEBUG] ${message}`);
    }
  }
};

module.exports = logger;
