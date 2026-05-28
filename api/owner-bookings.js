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
  const salonId = sanitize(username, 100);
  if (!salonId) return res.status(400).json({ error: 'username مطلوب' });

  try {
    const db = getDb();

    // Pending bookings — no composite index needed (no orderBy)
    const pendingSnap = await db.collection('bookings')
      .where('salonId', '==', salonId)
      .where('status', '==', 'pending')
      .get();

    const pending = pendingSnap.docs
      .map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.()?.toISOString() || null }))
      .sort((a, b) => (b.createdAt || '') > (a.createdAt || '') ? 1 : -1);

    // Recent bookings for stats (all statuses)
    const recentSnap = await db.collection('bookings')
      .where('salonId', '==', salonId)
      .get();

    const today = new Date().toISOString().split('T')[0];
    let revenue = 0, todayCount = 0, completedCount = 0;

    const recent = recentSnap.docs
      .map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.()?.toISOString() || null }))
      .sort((a, b) => (b.createdAt || '') > (a.createdAt || '') ? 1 : -1)
      .slice(0, 10);

    recent.forEach(b => {
      if (b.status === 'completed') { revenue += b.servicePrice || 0; completedCount++; }
      if (b.dateTime && b.dateTime.startsWith(today)) todayCount++;
    });

    return res.status(200).json({
      success: true,
      pending,
      recent,
      stats: { revenue, todayCount, completedCount, pendingCount: pending.length }
    });
  } catch (err) {
    console.error('owner-bookings error:', err.message);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
}
