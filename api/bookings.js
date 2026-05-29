import { setCors, checkRateLimit, verifyPiToken } from './_lib.js';
import { getDb } from './_firebase.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!(await checkRateLimit(req))) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  // VULN-01/02 fix: derive username from verified Pi token, never from request body
  const username = await verifyPiToken(req);
  if (!username) {
    return res.status(401).json({ error: 'غير مصرح — يلزم تسجيل الدخول بـ Pi' });
  }

  try {
    const db = getDb();
    const snap = await db.collection('bookings')
      .where('user', '==', username)
      .get();

    const bookings = snap.docs
      .map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        };
      })
      .sort((a, b) => (b.createdAt || '') > (a.createdAt || '') ? 1 : -1);

    return res.status(200).json({ success: true, bookings });
  } catch (err) {
    console.error('bookings fetch error:', err.message);
    // VULN-18 fix: never expose internal error details to the client
    return res.status(500).json({ error: 'Server error' });
  }
}
