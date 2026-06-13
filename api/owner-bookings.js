import { setCors, checkRateLimit, verifyPiToken } from './_lib.js';
import { getDb } from './_firebase.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!(await checkRateLimit(req))) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  // VULN-01/03 fix: derive salonId from verified Pi token — never from request body
  const salonId = await verifyPiToken(req);
  if (!salonId) {
    return res.status(401).json({ error: 'غير مصرح — يلزم تسجيل الدخول بـ Pi' });
  }

  try {
    const db = getDb();

    // Calendar mode: return all bookings with minimal fields for calendar view
    if (req.body && req.body.calendar === true) {
      const snap = await db.collection('bookings').where('salonId', '==', salonId).get();
      const calendar = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          date: data.date || (data.dateTime || '').split(' ')[0],
          dateTime: data.dateTime || '',
          status: data.status || 'pending',
          user: data.userId || data.user || '',
          service: data.serviceName || data.service || '',
        };
      });
      return res.status(200).json({ success: true, calendar });
    }

    const pendingSnap = await db.collection('bookings')
      .where('salonId', '==', salonId)
      .where('status', '==', 'pending')
      .get();

    const pending = pendingSnap.docs
      .map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.()?.toISOString() || null }))
      .sort((a, b) => (b.createdAt || '') > (a.createdAt || '') ? 1 : -1);

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
    // VULN-18 fix: never expose internal error details
    return res.status(500).json({ error: 'Server error' });
  }
}
