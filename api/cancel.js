import { FieldValue } from 'firebase-admin/firestore';
import { setCors, checkRateLimit, sanitize, verifyPiToken } from './_lib.js';
import { getDb } from './_firebase.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

  if (!(await checkRateLimit(req))) {
    return res.status(429).json({ success: false, error: 'Too many requests' });
  }

  // VULN-01/06 fix: verify Pi token — user identity comes from token, not body
  const verifiedUser = await verifyPiToken(req);
  if (!verifiedUser) {
    return res.status(401).json({ success: false, error: 'غير مصرح' });
  }

  const { bookingId, confirm } = req.body || {};
  const cleanBookingId = sanitize(bookingId, 100);

  if (!cleanBookingId) {
    return res.status(400).json({ success: false, error: 'bookingId مطلوب' });
  }

  try {
    const db = getDb();
    const bookingSnap = await db.collection('bookings').doc(cleanBookingId).get();

    if (!bookingSnap.exists) {
      return res.status(404).json({ success: false, error: 'الحجز غير موجود' });
    }

    const booking = bookingSnap.data();

    // VULN-06 fix: verify the requesting user owns this booking
    if (booking.user !== verifiedUser && booking.userId !== verifiedUser) {
      return res.status(403).json({ success: false, error: 'غير مصرح' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'الحجز ملغي مسبقاً' });
    }

    const bookingTime = new Date(booking.dateTime);
    if (isNaN(bookingTime.getTime())) {
      return res.status(400).json({ success: false, error: 'تاريخ الحجز غير صالح' });
    }

    const now = new Date();
    const hoursUntilBooking = (bookingTime - now) / (1000 * 60 * 60);

    let refundPolicy, refundAmount, refundPercentage;
    const paidAmount = parseFloat(booking.total || booking.depositPaid || 0);

    if (hoursUntilBooking >= 24) {
      refundPercentage = 100; refundAmount = paidAmount; refundPolicy = 'full_refund';
    } else if (hoursUntilBooking >= 2) {
      refundPercentage = 50; refundAmount = paidAmount * 0.5; refundPolicy = 'partial_refund';
    } else {
      refundPercentage = 0; refundAmount = 0; refundPolicy = 'no_refund';
    }

    const message = getRefundMessage(refundPolicy, refundAmount.toFixed(2), refundPercentage);

    // If confirm=true, perform the actual cancellation server-side
    if (confirm === true) {
      await bookingSnap.ref.update({
        status: 'cancelled',
        cancelledAt: FieldValue.serverTimestamp(),
        refundPolicy,
        refundAmount: parseFloat(refundAmount.toFixed(2)),
      });
    }

    return res.status(200).json({
      success: true,
      bookingId: cleanBookingId,
      hoursUntilBooking: hoursUntilBooking.toFixed(1),
      refundPolicy,
      refundPercentage,
      refundAmount: refundAmount.toFixed(2),
      message,
      cancelled: confirm === true,
    });

  } catch (error) {
    console.error('cancel error:', error.message);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}

function getRefundMessage(policy, amount, percentage) {
  switch (policy) {
    case 'full_refund':    return `✅ سيتم استرداد ${amount} Pi كاملاً خلال 24 ساعة`;
    case 'partial_refund': return `⚠️ سيتم استرداد ${percentage}% فقط (${amount} Pi) لأن الإلغاء أقل من 24 ساعة`;
    case 'no_refund':      return `❌ لا يمكن الاسترداد — الإلغاء أقل من ساعتين من الموعد`;
    default:               return 'تم معالجة الإلغاء';
  }
}
