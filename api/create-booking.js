import { randomInt } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { setCors, checkRateLimit, sanitize, isValidPhone } from './_lib.js';
import { getDb } from './_firebase.js';

const COMMISSION = 0.1;
const PRICE_TOLERANCE = 0.001;

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!(await checkRateLimit(req))) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { paymentId, txid, salonId, serviceName, date, time, userId } = req.body || {};

  const cleanPaymentId   = sanitize(paymentId, 100);
  const cleanTxid        = sanitize(txid, 200);
  const cleanSalonId     = sanitize(salonId, 100);
  const cleanServiceName = sanitize(serviceName, 100);
  const cleanDate        = sanitize(date, 20);
  const cleanTime        = sanitize(time, 10);
  const cleanUserId      = sanitize(userId, 100);

  if (!cleanPaymentId || !cleanTxid || !cleanSalonId || !cleanServiceName || !cleanDate || !cleanTime || !cleanUserId) {
    return res.status(400).json({ error: 'بيانات ناقصة' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    return res.status(400).json({ error: 'تنسيق التاريخ غير صالح' });
  }
  if (!/^\d{1,2}:\d{2}$/.test(cleanTime)) {
    return res.status(400).json({ error: 'تنسيق الوقت غير صالح' });
  }

  const PI_API_KEY = process.env.PI_API_KEY;
  if (!PI_API_KEY) {
    console.error('create-booking: PI_API_KEY not set');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  try {
    // ── 1. إتمام دفعة Pi والحصول على المبلغ الفعلي ──────────────────────────
    const piRes = await fetch(
      `https://api.minepi.com/v2/payments/${encodeURIComponent(cleanPaymentId)}/complete`,
      {
        method: 'POST',
        headers: { 'Authorization': `Key ${PI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ txid: cleanTxid }),
      }
    );

    if (!piRes.ok) {
      const piErrText = await piRes.text().catch(() => '');
      console.error(`create-booking: Pi complete failed status=${piRes.status} body=${piErrText}`);
      return res.status(400).json({ error: 'فشل إتمام الدفع', piStatus: piRes.status });
    }

    const piPayment = await piRes.json();
    const paidAmount = Number(piPayment.amount);

    // ── 2. جلب بيانات الصالون والتحقق من سعر الخدمة ──────────────────────────
    const db = getDb();
    const salonSnap = await db.collection('salons').doc(cleanSalonId).get();

    if (!salonSnap.exists) {
      return res.status(404).json({ error: 'الصالون غير موجود' });
    }

    const salon = salonSnap.data();
    const services = Array.isArray(salon.services) ? salon.services : [];
    const service = services.find(s => s.name === cleanServiceName);

    if (!service) {
      return res.status(400).json({ error: 'الخدمة غير موجودة في هذا الصالون' });
    }

    // ── 3. التحقق من أن المبلغ المدفوع يطابق السعر الحقيقي ──────────────────
    const expectedAmount = +(service.price + COMMISSION).toFixed(1);
    if (Math.abs(paidAmount - expectedAmount) > PRICE_TOLERANCE) {
      console.error(`PRICE_MISMATCH user=${cleanUserId} salon=${cleanSalonId} paid=${paidAmount} expected=${expectedAmount}`);
      return res.status(400).json({ error: 'مبلغ الدفع لا يطابق سعر الخدمة' });
    }

    // ── 4. Transaction: قفل الوقت + إنشاء الحجز (atomic) ────────────────────
    const slotLockId  = `${cleanSalonId}_${cleanDate}_${cleanTime.replace(':', '-')}`;
    const slotLockRef = db.collection('slot_locks').doc(slotLockId);
    const bookingRef  = db.collection('bookings').doc();
    const notifRef    = db.collection('notifications').doc();
    const fullDateTime = `${cleanDate} ${cleanTime}`;
    const checkInCode  = String(randomInt(100000, 1000000));

    await db.runTransaction(async (tx) => {
      const slotSnap = await tx.get(slotLockRef);
      if (slotSnap.exists) throw Object.assign(new Error('SLOT_TAKEN'), { code: 'SLOT_TAKEN' });

      // قفل الوقت
      tx.set(slotLockRef, {
        salonId: cleanSalonId,
        date: cleanDate,
        time: cleanTime,
        userId: cleanUserId,
        bookedAt: FieldValue.serverTimestamp(),
      });

      // إنشاء الحجز
      tx.set(bookingRef, {
        userId: cleanUserId,
        user: cleanUserId,
        salonId: cleanSalonId,
        salonName: salon.name,
        salon: salon.name,
        salonCity: salon.city || '',
        city: salon.city || '',
        salonPhone: salon.phone || '',
        serviceName: cleanServiceName,
        service: cleanServiceName,
        serviceDuration: service.duration || 30,
        servicePrice: service.price,
        gender: salon.gender || '',
        date: cleanDate,
        time: cleanTime,
        dateTime: fullDateTime,
        status: 'pending',
        commission: COMMISSION,
        total: paidAmount,
        depositPaid: paidAmount,
        txid: cleanTxid,
        paymentId: cleanPaymentId,
        paymentStatus: 'paid',
        checkInCode,
        isReviewed: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      // إشعار للصالون داخل نفس الـ transaction
      tx.set(notifRef, {
        to: cleanSalonId,
        type: 'new_booking',
        title: 'حجز جديد',
        body: `@${cleanUserId} حجز ${cleanServiceName} في ${fullDateTime}`,
        bookingId: bookingRef.id,
        salonId: cleanSalonId,
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    // ── 5. إرسال WhatsApp (خارج الـ transaction — لا يُلغي الحجز لو فشل) ─────
    const ownerPhone = salon.phone || salon.ownerPhone || '';
    if (ownerPhone && isValidPhone(ownerPhone)) {
      fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : ''}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerPhone,
          salonName: salon.name,
          customerName: cleanUserId,
          serviceName: cleanServiceName,
          dateTime: fullDateTime,
          depositAmount: paidAmount,
          bookingId: bookingRef.id,
          type: 'new_booking',
        }),
      }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      bookingId: bookingRef.id,
      checkInCode,
      salonName: salon.name,
      serviceName: cleanServiceName,
      dateTime: fullDateTime,
      total: paidAmount,
    });

  } catch (err) {
    if (err.code === 'SLOT_TAKEN') {
      return res.status(409).json({ error: 'هذا الوقت محجوز — اختر وقتاً آخر', code: 'SLOT_TAKEN' });
    }
    console.error('create-booking error:', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
}
