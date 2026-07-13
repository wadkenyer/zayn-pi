// api/check-slot.js — التحقق من توفر وقت حجز (فردي أو جميع أوقات يوم)
import { getAdminDb, cors } from './_admin.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { salonId, date, time } = req.body;
  if (!salonId || !date) return res.status(400).json({ error: 'salonId و date مطلوبة' });

  try {
    const db = getAdminDb();

    // وضع batch: time غائب أو '*' — أعد جميع الأوقات المحجوزة لهذا اليوم
    if (!time || time === '*') {
      const snap = await db.collection('bookings')
        .where('salonId', '==', salonId)
        .where('dateTime', '>=', `${date} 00:00`)
        .where('dateTime', '<=', `${date} 99:99`)
        .get();

      const bookedTimes = snap.docs
        .filter(d => !['cancelled', 'rejected'].includes(d.data().status))
        .map(d => (d.data().dateTime || '').split(' ')[1])
        .filter(Boolean);

      return res.status(200).json({ bookedTimes });
    }

    // وضع فردي: تحقق من وقت محدد
    const snap = await db.collection('bookings')
      .where('salonId', '==', salonId)
      .where('dateTime', '==', `${date} ${time}`)
      .get();

    const isBooked = snap.docs.some(d => !['cancelled', 'rejected'].includes(d.data().status));
    return res.status(200).json({
      available: !isBooked,
      message: isBooked ? 'هذا الوقت محجوز مسبقاً' : 'الوقت متاح'
    });

  } catch (error) {
    console.error('check-slot error:', error.message);
    return res.status(500).json({ error: 'خطأ في التحقق من الوقت' });
  }
}
