import { setCors, checkRateLimit, sanitize } from './_lib.js';
import { getDb } from './_firebase.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!(await checkRateLimit(req))) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { username } = req.body || {};
  const cleanUsername = sanitize(username, 100);
  if (!cleanUsername) {
    return res.status(400).json({ error: 'username مطلوب' });
  }

  try {
    const db = getDb();
    const snap = await db.collection('bookings')
      .where('user', '==', cleanUsername)
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
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
}
