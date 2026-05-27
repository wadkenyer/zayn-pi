// api/get-bookings.js — جلب الحجوزات للزبون أو صاحب الصالون
import { getAdminDb, cors } from './_admin.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { username, type } = req.body;
  // type: 'user' | 'salon' | 'salon-pending'

  if (!username || !type) return res.status(400).json({ error: 'username و type مطلوبان' });

  try {
    const db = getAdminDb();
    let q = db.collection('bookings');

    if (type === 'user') {
      q = q.where('user', '==', username);
    } else if (type === 'salon') {
      q = q.where('salonId', '==', username);
    } else if (type === 'salon-pending') {
      q = q.where('salonId', '==', username).where('status', '==', 'pending');
    } else {
      return res.status(400).json({ error: 'type غير صحيح' });
    }

    const snap = await q.get();

    const bookings = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null
      };
    });

    return res.status(200).json({ success: true, bookings });

  } catch (error) {
    console.error('get-bookings error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
