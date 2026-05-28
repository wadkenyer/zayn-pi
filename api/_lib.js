import { Ratelimit } from '@upstash/ratelimit';
import { Redis }     from '@upstash/redis';

// Shared security utilities for all API endpoints

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://zaynpiddbdfaeb4520.pinet.com').split(',').map(o => o.trim());

// Distributed rate limiter via Upstash Redis (works across all serverless instances)
let _ratelimit = null;
function getRatelimit() {
  if (_ratelimit) return _ratelimit;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  _ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(20, '60 s'),
    analytics: false,
  });
  return _ratelimit;
}

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

export async function checkRateLimit(req) {
  const rl = getRatelimit();

  // If Upstash is not configured yet, allow all requests (fail open)
  if (!rl) return true;

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress
    || 'unknown';

  const { success } = await rl.limit(ip);
  return success;
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
