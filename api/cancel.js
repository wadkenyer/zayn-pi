import { setCors, checkRateLimit, sanitize } from './_lib.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

  if (!checkRateLimit(req)) {
    return res.status(429).json({ success: false, error: 'Too many requests' });
  }

  const { bookingId, user, bookingDateTime, amount } = req.body || {};

  const cleanBookingId = sanitize(bookingId, 100);
  const cleanUser = sanitize(user, 100);

  if (!cleanBookingId || !cleanUser || !bookingDateTime) {
    return res.status(400).json({ success: false, error: 'bookingId و user و bookingDateTime مطلوبة' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount < 0 || parsedAmount > 10000) {
    return res.status(400).json({ success: false, error: 'amount غير صالح' });
  }

  const bookingTime = new Date(bookingDateTime);
  if (isNaN(bookingTime.getTime())) {
    return res.status(400).json({ success: false, error: 'bookingDateTime غير صالح' });
  }

  try {
    const now = new Date();
    const hoursUntilBooking = (bookingTime - now) / (1000 * 60 * 60);

    let refundPolicy, refundAmount, refundPercentage;

    if (hoursUntilBooking >= 24) {
      refundPercentage = 100;
      refundAmount = parsedAmount;
      refundPolicy = 'full_refund';
    } else if (hoursUntilBooking >= 2) {
      refundPercentage = 50;
      refundAmount = parsedAmount * 0.5;
      refundPolicy = 'partial_refund';
    } else {
      refundPercentage = 0;
      refundAmount = 0;
      refundPolicy = 'no_refund';
    }

    return res.status(200).json({
      success: true,
      bookingId: cleanBookingId,
      user: cleanUser,
      hoursUntilBooking: hoursUntilBooking.toFixed(1),
      refundPolicy,
      refundPercentage,
      refundAmount: refundAmount.toFixed(2),
      message: getRefundMessage(refundPolicy, refundAmount, refundPercentage)
    });

  } catch (error) {
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
