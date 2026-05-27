// api/create-booking.js — إنشاء حجز جديد بعد اكتمال الدفع
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, cors } from './_admin.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const {
    userId, salonId, salonName, salonCity, salonPhone,
    serviceName, servicePrice, serviceDuration, gender,
    date, time, dateTime, total, txid, paymentId
  } = req.body;

  if (!userId || !salonId || !dateTime || !txid) {
    return res.status(400).json({ error: 'userId و salonId و dateTime و txid مطلوبة' });
  }

  try {
    const db = getAdminDb();
    const checkInCode = Math.floor(100000 + Math.random() * 900000).toString();

    const bookingRef = await db.collection('bookings').add({
      userId, user: userId,
      salonId, salonName: salonName || '', salon: salonName || '',
      salonCity: salonCity || '', city: salonCity || '',
      salonPhone: salonPhone || '',
      serviceName: serviceName || '', service: serviceName || '',
      servicePrice: parseFloat(servicePrice) || 0,
      serviceDuration: parseInt(serviceDuration) || 30,
      gender: gender || '',
      date: date || '', time: time || '', dateTime,
      status: 'pending',
      commission: 0.1,
      total: parseFloat(total) || 0,
      depositPaid: parseFloat(total) || 0,
      txid,
      paymentId: paymentId || '',
      paymentStatus: 'paid',
      checkInCode,
      isReviewed: false,
      createdAt: FieldValue.serverTimestamp()
    });

    await db.collection('notifications').add({
      to: salonId,
      type: 'new_booking',
      title: 'حجز جديد',
      body: `@${userId} حجز ${serviceName} في ${dateTime}`,
      bookingId: bookingRef.id,
      salonId,
      isRead: false,
      createdAt: FieldValue.serverTimestamp()
    });

    return res.status(200).json({ success: true, bookingId: bookingRef.id, checkInCode });

  } catch (error) {
    console.error('create-booking error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
