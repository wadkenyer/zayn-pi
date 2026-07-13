// api/save-salon.js — إنشاء الصالون وتعديل إعداداته والخدمات والتقييمات
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, cors } from './_admin.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { ownerUsername, action, data } = req.body;

  if (!ownerUsername || !action) {
    return res.status(400).json({ error: 'ownerUsername و action مطلوبان' });
  }

  try {
    const db = getAdminDb();
    const salonRef = db.collection('salons').doc(ownerUsername);

    switch (action) {

      case 'register': {
        const { name, city, gender, phone, img, desc, openTime, closeTime, txid } = data || {};
        if (!name || !city) return res.status(400).json({ error: 'name و city مطلوبان' });
        await salonRef.set({
          name, city,
          gender: gender || 'men',
          phone: phone || '',
          img: img || '',
          desc: desc || '',
          openTime: openTime || '9:00',
          closeTime: closeTime || '21:00',
          owner: ownerUsername,
          available: true,
          services: [],
          rating: 5.0,
          reviews: 0,
          revenue: 0,
          registrationTxid: txid || '',
          createdAt: FieldValue.serverTimestamp()
        });
        break;
      }

      case 'update-settings': {
        const allowed = ['name', 'city', 'phone', 'img', 'desc', 'openTime', 'closeTime', 'closedDates', 'rating', 'reviewCount'];
        const updates = {};
        for (const key of allowed) {
          if (data?.[key] !== undefined) updates[key] = data[key];
        }
        if (!Object.keys(updates).length) return res.status(400).json({ error: 'لا يوجد تعديلات' });
        await salonRef.update(updates);
        break;
      }

      case 'toggle-availability': {
        const snap = await salonRef.get();
        if (!snap.exists) return res.status(404).json({ error: 'الصالون غير موجود' });
        const newAvail = !(snap.data().available !== false);
        await salonRef.update({ available: newAvail });
        return res.status(200).json({ success: true, available: newAvail });
      }

      case 'update-services': {
        if (!Array.isArray(data?.services)) return res.status(400).json({ error: 'services مطلوبة' });
        await salonRef.update({ services: data.services });
        break;
      }

      case 'update-rating': {
        const snap = await salonRef.get();
        if (!snap.exists) return res.status(404).json({ error: 'الصالون غير موجود' });
        const d = snap.data();
        const oldRating  = d.rating  || 5.0;
        const oldReviews = d.reviews || 0;
        const newReviews = oldReviews + 1;
        const newRating  = parseFloat(((oldRating * oldReviews + parseInt(data.stars)) / newReviews).toFixed(1));
        await salonRef.update({ rating: newRating, reviews: newReviews });
        return res.status(200).json({ success: true, newRating, newReviews });
      }

      default:
        return res.status(400).json({ error: 'action غير معروف' });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('save-salon error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
