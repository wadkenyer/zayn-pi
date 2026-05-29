import { FieldValue } from 'firebase-admin/firestore';
import { setCors, checkRateLimit, verifyPiToken, sanitize } from './_lib.js';
import { getDb } from './_firebase.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!(await checkRateLimit(req))) return res.status(429).json({ error: 'Too many requests' });

  // VULN-08 fix: verify Pi token — salonId derived from token, not body
  const verifiedUser = await verifyPiToken(req);
  if (!verifiedUser) return res.status(401).json({ error: 'غير مصرح' });

  const { paymentId, txid, name, city, gender, phone, img, desc, openTime, closeTime } = req.body || {};

  const cleanPaymentId = sanitize(paymentId || '', 100);
  const cleanTxid      = sanitize(txid      || '', 200);
  const cleanName      = sanitize(name      || '', 100);
  const cleanCity      = sanitize(city      || '', 100);
  const cleanGender    = ['men', 'women', 'both'].includes(gender) ? gender : 'men';
  const cleanPhone     = sanitize(phone     || '', 20);
  const cleanDesc      = sanitize(desc      || '', 500);
  const cleanOpenTime  = /^\d{2}:\d{2}$/.test(openTime  || '') ? openTime  : '09:00';
  const cleanCloseTime = /^\d{2}:\d{2}$/.test(closeTime || '') ? closeTime : '21:00';

  if (!cleanPaymentId || !cleanTxid) return res.status(400).json({ error: 'بيانات الدفع مطلوبة' });
  if (!cleanName || !cleanCity)      return res.status(400).json({ error: 'اسم الصالون والمدينة مطلوبان' });

  const PI_API_KEY = process.env.PI_API_KEY;
  if (!PI_API_KEY) return res.status(500).json({ error: 'Server misconfiguration' });

  try {
    const db = getDb();

    // Prevent duplicate registration
    const existingSnap = await db.collection('salons').doc(verifiedUser).get();
    if (existingSnap.exists) return res.status(409).json({ error: 'لديك صالون مسجل مسبقاً' });

    // Complete the Pi payment server-side
    const piRes = await fetch(
      `https://api.minepi.com/v2/payments/${encodeURIComponent(cleanPaymentId)}/complete`,
      {
        method: 'POST',
        headers: { 'Authorization': `Key ${PI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ txid: cleanTxid })
      }
    );
    if (!piRes.ok) {
      const errText = await piRes.text().catch(() => '');
      console.error(`register-salon: Pi complete failed status=${piRes.status} body=${errText}`);
      return res.status(400).json({ error: 'فشل إتمام الدفع' });
    }

    const defaultImg = cleanGender === 'women'
      ? 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600'
      : 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600';
    const finalImg = (img && typeof img === 'string' && img.startsWith('https://'))
      ? img.trim().slice(0, 500) : defaultImg;

    await db.collection('salons').doc(verifiedUser).set({
      name: cleanName, city: cleanCity, gender: cleanGender,
      img: finalImg, phone: cleanPhone, desc: cleanDesc,
      openTime: cleanOpenTime, closeTime: cleanCloseTime,
      owner: verifiedUser,
      available: true, rating: 5.0, reviews: 0, revenue: 0,
      registrationTxid: cleanTxid, services: [],
      createdAt: FieldValue.serverTimestamp()
    });

    return res.status(200).json({ success: true, salonName: cleanName });
  } catch(e) {
    console.error('register-salon error:', e);
    return res.status(500).json({ error: 'خطأ في تسجيل الصالون' });
  }
}
