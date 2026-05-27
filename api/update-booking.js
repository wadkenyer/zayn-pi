// api/update-booking.js — تحديث حالة الحجز (قبول/رفض/إلغاء/حضور/تقييم)
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, cors } from './_admin.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { bookingId, action, callerUsername, reason, reviewStars, reviewComment, checkInCode } = req.body;

  if (!bookingId || !action || !callerUsername) {
    return res.status(400).json({ error: 'bookingId و action و callerUsername مطلوبة' });
  }

  try {
    const db = getAdminDb();
    let bookingRef;
    let snap;

    // checkin يبحث بالكود لأن العميل لا يعرف bookingId
    if (action === 'checkin' && bookingId === 'by-code') {
      const q = await db.collection('bookings')
        .where('salonId', '==', callerUsername)
        .where('checkInCode', '==', checkInCode)
        .limit(1).get();
      if (q.empty) return res.status(404).json({ error: 'كود غير صحيح' });
      snap = q.docs[0];
      bookingRef = snap.ref;
    } else {
      bookingRef = db.collection('bookings').doc(bookingId);
      snap = await bookingRef.get();
      if (!snap.exists) return res.status(404).json({ error: 'الحجز غير موجود' });
    }

    const b = snap.data();
    let updates = {};
    let responseExtra = {};

    switch (action) {

      case 'accept':
        if (b.salonId !== callerUsername) return res.status(403).json({ error: 'غير مصرح' });
        updates = { status: 'accepted', acceptedAt: FieldValue.serverTimestamp() };
        break;

      case 'reject':
        if (b.salonId !== callerUsername) return res.status(403).json({ error: 'غير مصرح' });
        updates = {
          status: 'rejected',
          cancelReason: reason || 'ظرف طارئ',
          cancelledBy: 'owner',
          cancelledAt: FieldValue.serverTimestamp()
        };
        break;

      case 'cancel': {
        const isUser  = b.userId === callerUsername || b.user === callerUsername;
        const isOwner = b.salonId === callerUsername;
        if (!isUser && !isOwner) return res.status(403).json({ error: 'غير مصرح' });

        // حساب سياسة الاسترداد
        const hoursLeft = (new Date(b.dateTime) - new Date()) / (1000 * 60 * 60);
        const refundPolicy = hoursLeft >= 24 ? 'full_refund' : hoursLeft >= 2 ? 'partial_refund' : 'no_refund';
        const refundAmount = refundPolicy === 'full_refund' ? b.total :
                             refundPolicy === 'partial_refund' ? +(b.total * 0.5).toFixed(2) : 0;

        updates = {
          status: 'cancelled',
          cancelledBy: isOwner ? 'owner' : 'user',
          cancelledAt: FieldValue.serverTimestamp(),
          refundPolicy,
          refundAmount
        };
        responseExtra = { refundPolicy, refundAmount };
        break;
      }

      case 'checkin': {
        if (b.salonId !== callerUsername) return res.status(403).json({ error: 'غير مصرح' });
        if (b.status === 'cancelled' || b.status === 'rejected') {
          return res.status(400).json({ error: 'الحجز ملغي أو مرفوض' });
        }
        if (b.status === 'checkedin') {
          return res.status(400).json({ error: `تم تسجيل حضور @${b.userId || b.user} مسبقاً`, alreadyCheckedIn: true });
        }
        if (b.checkInCode !== checkInCode) {
          return res.status(400).json({ error: 'كود غير صحيح' });
        }
        updates = { status: 'checkedin', checkedInAt: FieldValue.serverTimestamp() };
        responseExtra = { customerName: b.userId || b.user, serviceName: b.serviceName || b.service, dateTime: b.dateTime };
        break;
      }

      case 'review': {
        const isBookingOwner = b.userId === callerUsername || b.user === callerUsername;
        if (!isBookingOwner) return res.status(403).json({ error: 'غير مصرح' });
        if (b.isReviewed) return res.status(400).json({ error: 'تم التقييم مسبقاً' });
        updates = {
          isReviewed: true,
          reviewStars: parseInt(reviewStars) || 5,
          reviewComment: reviewComment || '',
          reviewedAt: FieldValue.serverTimestamp()
        };
        responseExtra = { reviewStars: parseInt(reviewStars) || 5, salonId: b.salonId };
        break;
      }

      default:
        return res.status(400).json({ error: 'action غير معروف' });
    }

    await bookingRef.update(updates);
    return res.status(200).json({ success: true, bookingId, action, ...responseExtra });

  } catch (error) {
    console.error('update-booking error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
