import { setCors, checkRateLimit, verifyPiToken } from './_lib.js';
import { getDb } from './_firebase.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

  if (!(await checkRateLimit(req))) {
    return res.status(429).json({ success: false, error: 'Too many requests' });
  }

  // Require authenticated Pi user
  const verifiedUser = await verifyPiToken(req);
  if (!verifiedUser) {
    return res.status(401).json({ success: false, error: 'غير مصرح — يلزم تسجيل الدخول بـ Pi' });
  }

  const { paymentId } = req.body || {};
  if (!paymentId || typeof paymentId !== 'string' || paymentId.length > 100) {
    return res.status(400).json({ success: false, error: 'paymentId مطلوب' });
  }

  const PI_API_KEY = process.env.PI_API_KEY;
  if (!PI_API_KEY) {
    return res.status(500).json({ success: false, error: 'Server misconfiguration' });
  }

  try {
    const db = getDb();

    // Ownership check: the requester must be either the booking's customer OR the salon owner
    const bookingSnap = await db.collection('bookings')
      .where('paymentId', '==', paymentId)
      .limit(1)
      .get();

    if (bookingSnap.empty) {
      // No booking found for this paymentId — deny to prevent probing arbitrary payment IDs
      return res.status(403).json({ success: false, error: 'غير مصرح — لا توجد معاملة مرتبطة بحسابك' });
    }

    const booking = bookingSnap.docs[0].data();
    const isCustomer = booking.user === verifiedUser || booking.userId === verifiedUser;
    const isSalonOwner = booking.salonId === verifiedUser;

    if (!isCustomer && !isSalonOwner) {
      return res.status(403).json({ success: false, error: 'غير مصرح — هذه المعاملة لا تخصك' });
    }

    // Verified party — fetch payment details from Pi API
    const response = await fetch(
      `https://api.minepi.com/v2/payments/${encodeURIComponent(paymentId)}`,
      {
        method: 'GET',
        headers: { 'Authorization': `Key ${PI_API_KEY}` },
      }
    );

    const data = await response.json();

    if (response.ok) {
      return res.status(200).json({ success: true, data });
    }
    return res.status(response.status).json({ success: false, error: 'فشل في جلب بيانات الدفع' });

  } catch (error) {
    console.error('verify error:', error.message);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}
