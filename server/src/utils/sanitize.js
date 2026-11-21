/**
 * Strips HTML tags, script payloads, null bytes, and control characters
 * from user-supplied strings while preserving legitimate punctuation.
 */
export const sanitizeString = (value) => {
  if (typeof value !== 'string') return value;

  return value
    // Remove script/style blocks and their contents first
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    // Strip any remaining HTML/XML tags
    .replace(/<[^>]*>/g, '')
    // Remove null bytes and non-printable control characters
    .replace(/[\u0000-\u001F\u007F]/g, '')
    // Collapse repeated whitespace and trim edges
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Recursively sanitizes objects/arrays:
 * - Blocks MongoDB operator injection keys starting with "$" or containing "."
 * - Sanitizes all string leaf values
 */
export const sanitizePayload = (input) => {
  if (typeof input === 'string') {
    return sanitizeString(input);
  }

  if (Array.isArray(input)) {
    return input.map(sanitizePayload);
  }

  if (input !== null && typeof input === 'object') {
    const cleaned = {};
    for (const [key, val] of Object.entries(input)) {
      // Drop NoSQL operator keys (e.g. "$ne", "$gt", "price.gt")
      if (key.startsWith('$') || key.includes('.')) {
        continue;
      }
      cleaned[key] = sanitizePayload(val);
    }
    return cleaned;
  }

  return input;
};