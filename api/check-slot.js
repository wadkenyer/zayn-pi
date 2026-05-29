import { setCors, checkRateLimit, sanitize } from './_lib.js';
import { getDb } from './_firebase.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!(await checkRateLimit(req))) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { salonId, date, time } = req.body || {};

  const cleanSalonId = sanitize(salonId, 100);
  const cleanDate    = sanitize(date, 20);
  const cleanTime    = sanitize(time, 10);

  if (!cleanSalonId || !cleanDate || !cleanTime) {
    return res.status(400).json({ error: 'salonId و date و time مطلوبة' });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    return res.status(400).json({ error: 'تنسيق التاريخ غير صالح' });
  }

  if (!/^\d{1,2}:\d{2}$/.test(cleanTime)) {
    return res.status(400).json({ error: 'تنسيق الوقت غير صالح' });
  }

  try {
    // VULN-10 fix: use Admin SDK instead of unauthenticated Firestore REST API
    // VULN-19 fix: fail closed — return available:false on error
    const db = getDb();
    const slotId = `${cleanSalonId}_${cleanDate}_${cleanTime.replace(':', '-')}`;
    const slotSnap = await db.collection('slot_locks').doc(slotId).get();

    return res.status(200).json({
      available: !slotSnap.exists,
      message: slotSnap.exists ? 'هذا الوقت محجوز مسبقاً' : 'الوقت متاح'
    });

  } catch (error) {
    console.error('check-slot error:', error.message);
    // VULN-19 fix: fail closed — treat errors as "not available" to be safe
    return res.status(200).json({ available: false, message: 'تعذّر التحقق' });
  }
}
