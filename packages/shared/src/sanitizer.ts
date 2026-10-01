/**
 * Sensitive data sanitizer for logging and storage in PayGo Integration Lab.
 * Ensures API keys, webhook secrets, and customer PII are never leaked.
 */

export function maskPhone(phone?: string | null): string {
  if (!phone) return '';
  const cleaned = phone.trim();
  if (cleaned.length <= 4) return '***';
  const start = cleaned.slice(0, 3);
  const end = cleaned.slice(-3);
  return `${start}***${end}`;
}

export function maskEmail(email?: string | null): string {
  if (!email) return '';
  const parts = email.split('@');
  if (parts.length !== 2) return '***@***';
  const [user, domain] = parts;
  const visible = user.slice(0, Math.min(3, user.length));
  return `${visible}***@${domain}`;
}

const SENSITIVE_KEY_PATTERNS = [
  /api[-_]?key/i,
  /secret/i,
  /password/i,
  /authorization/i,
  /token/i,
  /cookie/i,
  /x-api-key/i,
];

export function sanitizeHeaders(headers: Record<string, any>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
  }
  return sanitized;
}

export function sanitizePayload(data: unknown): unknown {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    // Try parsing if stringified JSON
    try {
      const parsed = JSON.parse(data);
      return sanitizePayload(parsed);
    } catch {
      return data;
    }
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizePayload(item));
  }

  if (typeof data === 'object') {
    const sanitizedObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitiveKey) {
        sanitizedObj[key] = '[REDACTED]';
      } else if (/(phone|telefone|customer_phone)/i.test(key) && typeof value === 'string') {
        sanitizedObj[key] = maskPhone(value);
      } else if (/(email|customer_email)/i.test(key) && typeof value === 'string') {
        sanitizedObj[key] = maskEmail(value);
      } else {
        sanitizedObj[key] = sanitizePayload(value);
      }
    }
    return sanitizedObj;
  }

  return data;
}

export function safeJsonStringify(data: unknown): string {
  try {
    return JSON.stringify(sanitizePayload(data), null, 2);
  } catch (error) {
    return String(data);
  }
}
