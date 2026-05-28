// Shared security utilities for all API endpoints

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://zaynpiddbdfaeb4520.pinet.com').split(',').map(o => o.trim());

// In-memory rate limiter (per serverless instance)
const rateLimitMap = new Map();
const RATE_LIMIT = 20;       // max requests
const RATE_WINDOW = 60_000;  // per 1 minute

export function setCors(req, res) {
  const origin = req.headers['origin'] || '';
  const isAllowed =
    ALLOWED_ORIGINS.includes(origin) ||
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.pinet\.com$/.test(origin);

  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  return isAllowed;
}

export function checkRateLimit(req) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress
    || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };

  if (now - entry.start > RATE_WINDOW) {
    entry.count = 1;
    entry.start = now;
  } else {
    entry.count++;
  }
  rateLimitMap.set(ip, entry);

  // Prune old entries
  if (rateLimitMap.size > 2000) {
    for (const [key, val] of rateLimitMap) {
      if (now - val.start > RATE_WINDOW) rateLimitMap.delete(key);
    }
  }

  return entry.count <= RATE_LIMIT;
}

// Strip HTML/script-injectable chars and cap length
export function sanitize(value, maxLen = 200) {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>"'`]/g, '').trim().slice(0, maxLen);
}

// Validate E.164-ish phone numbers
export function isValidPhone(phone) {
  return typeof phone === 'string' && /^\+?[1-9]\d{6,14}$/.test(phone.trim());
}
