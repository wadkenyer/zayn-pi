import { FieldValue } from 'firebase-admin/firestore';
import { setCors, checkRateLimit, sanitize } from './_lib.js';
import { getDb } from './_firebase.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!(await checkRateLimit(req))) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { action, bookingId, username, reason, code } = req.body || {};
  const cleanAction    = sanitize(action, 20);
  const cleanBookingId = sanitize(bookingId, 100);
  const cleanUsername  = sanitize(username, 100);

  if (!cleanAction || !cleanBookingId || !cleanUsername) {
    return res.status(400).json({ error: 'بيانات ناقصة' });
  }

  try {
    const db = getDb();
    const bookingRef = db.collection('bookings').doc(cleanBookingId);
    const bookingSnap = await bookingRef.get();

    if (!bookingSnap.exists) {
      return res.status(404).json({ error: 'الحجز غير موجود' });
    }

    const booking = bookingSnap.data();

    // Verify the requesting user owns the salon this booking belongs to
    if (booking.salonId !== cleanUsername) {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    if (cleanAction === 'accept') {
      await bookingRef.update({ status: 'accepted', acceptedAt: FieldValue.serverTimestamp() });
      return res.status(200).json({ success: true });
    }

    if (cleanAction === 'reject') {
      const cleanReason = sanitize(reason, 200) || 'ظرف طارئ';
      await bookingRef.update({
        status: 'rejected',
        cancelReason: cleanReason,
        cancelledBy: 'owner',
        cancelledAt: FieldValue.serverTimestamp()
      });
      return res.status(200).json({ success: true });
    }

    if (cleanAction === 'checkin') {
      const cleanCode = sanitize(code, 10);
      if (!cleanCode || !/^\d{6}$/.test(cleanCode)) {
        return res.status(400).json({ error: 'الكود يجب أن يكون 6 أرقام' });
      }

      // Find booking by checkin code for this salon
      const snap = await db.collection('bookings')
        .where('salonId', '==', cleanUsername)
        .where('checkInCode', '==', cleanCode)
        .get();

      if (snap.empty) return res.status(404).json({ error: 'كود غير صحيح' });

      const bDoc = snap.docs[0];
      const b = bDoc.data();

      if (b.status === 'cancelled' || b.status === 'rejected') {
        return res.status(400).json({ error: 'هذا الحجز ملغي أو مرفوض' });
      }
      if (b.status === 'checkedin') {
        return res.status(400).json({ error: `تم تسجيل حضور @${b.user} مسبقاً` });
      }

      await bDoc.ref.update({
        status: 'checkedin',
        checkedInAt: FieldValue.serverTimestamp()
      });

      return res.status(200).json({
        success: true,
        user: b.user,
        service: b.service || b.serviceName
      });
    }

    return res.status(400).json({ error: 'إجراء غير معروف' });

  } catch (err) {
    console.error('owner-action error:', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
}
