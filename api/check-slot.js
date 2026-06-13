// api/check-slot.js — التحقق من توفر وقت الحجز عبر Admin SDK
import { getAdminDb, cors } from './_admin.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { salonId, date, time } = req.body;
  if (!salonId || !date || !time) {
    return res.status(400).json({ error: 'salonId و date و time مطلوبة' });
  }

  try {
    const db = getAdminDb();
    const dateTime = `${date} ${time}`;

    const snap = await db.collection('bookings')
      .where('salonId', '==', salonId)
      .where('dateTime', '==', dateTime)
      .where('status', 'in', ['pending', 'accepted', 'checkedin'])
      .limit(1)
      .get();

    const isBooked = !snap.empty;

    return res.status(200).json({
      available: !isBooked,
      message: isBooked ? 'هذا الوقت محجوز مسبقاً' : 'الوقت متاح'
    });

  } catch (error) {
    console.error('check-slot error:', error.message);
    // إذا فشل التحقق — نمنع الحجز احترازياً
    return res.status(200).json({ available: false, message: 'تعذر التحقق، حاول مرة أخرى' });
  }
}
