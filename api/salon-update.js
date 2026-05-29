import { setCors, checkRateLimit, verifyPiToken, sanitize } from './_lib.js';
import { getDb } from './_firebase.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!(await checkRateLimit(req))) return res.status(429).json({ error: 'Too many requests' });

  // VULN-14 fix: verify Pi token — salonId derived from token, never from body
  const verifiedUser = await verifyPiToken(req);
  if (!verifiedUser) return res.status(401).json({ error: 'غير مصرح' });

  const { action } = req.body || {};
  const cleanAction = sanitize(action || '', 30);

  if (!cleanAction) return res.status(400).json({ error: 'action مطلوب' });

  try {
    const db = getDb();
    const salonRef  = db.collection('salons').doc(verifiedUser);
    const salonSnap = await salonRef.get();

    if (!salonSnap.exists) return res.status(404).json({ error: 'لم يتم العثور على الصالون' });

    if (cleanAction === 'toggle_availability') {
      const current = salonSnap.data().available !== false;
      await salonRef.update({ available: !current });
      return res.status(200).json({ success: true, available: !current });
    }

    if (cleanAction === 'update_info') {
      const { name, city, phone, img, desc, openTime, closeTime } = req.body || {};
      const updates = {};
      if (name)      updates.name      = sanitize(name, 100);
      if (city)      updates.city      = sanitize(city, 100);
      if (phone)     updates.phone     = sanitize(phone, 20);
      if (desc)      updates.desc      = sanitize(desc, 500);
      if (openTime  && /^\d{2}:\d{2}$/.test(openTime))  updates.openTime  = openTime;
      if (closeTime && /^\d{2}:\d{2}$/.test(closeTime)) updates.closeTime = closeTime;
      if (img && typeof img === 'string' && img.startsWith('https://')) {
        updates.img = img.trim().slice(0, 500);
      }
      if (!Object.keys(updates).length) return res.status(400).json({ error: 'لا يوجد تعديلات للحفظ' });
      await salonRef.update(updates);
      return res.status(200).json({ success: true, updates });
    }

    if (cleanAction === 'add_service') {
      const { name, duration, price } = req.body || {};
      const cleanSvcName = sanitize(name || '', 100);
      const svcDuration  = parseInt(duration);
      const svcPrice     = parseFloat(price);
      if (!cleanSvcName)                                    return res.status(400).json({ error: 'اسم الخدمة مطلوب' });
      if (!svcDuration || svcDuration < 1 || svcDuration > 480) return res.status(400).json({ error: 'مدة غير صالحة (1-480 دقيقة)' });
      if (!svcPrice    || svcPrice    < 0.01 || svcPrice > 10000) return res.status(400).json({ error: 'سعر غير صالح' });
      const services = [...(salonSnap.data().services || [])];
      services.push({ name: cleanSvcName, duration: svcDuration, price: svcPrice });
      await salonRef.update({ services });
      return res.status(200).json({ success: true, services });
    }

    if (cleanAction === 'delete_service') {
      const { serviceIndex } = req.body || {};
      const idx      = parseInt(serviceIndex);
      const services = [...(salonSnap.data().services || [])];
      if (isNaN(idx) || idx < 0 || idx >= services.length) {
        return res.status(400).json({ error: 'رقم الخدمة غير صالح' });
      }
      services.splice(idx, 1);
      await salonRef.update({ services });
      return res.status(200).json({ success: true, services });
    }

    return res.status(400).json({ error: 'إجراء غير معروف' });

  } catch(e) {
    console.error('salon-update error:', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
}
