// api/check-slot.js
// المهمة: منع حجز نفس الوقت مرتين في نفس الصالون

import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp() {
  if (getApps().length) return getApp();
  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin credentials missing (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)');
  }
  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') }),
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { salonId, date, time } = req.body;

  if (!salonId || !date || !time) {
    return res.status(400).json({ error: 'salonId و date و time مطلوبة' });
  }

  try {
    const db = getFirestore(getAdminApp());
    const dateTime = `${date} ${time}`;

    // نجلب الحجوزات بنفس الصالون والوقت، ونُصفّي الملغاة في الكود
    // لتجنّب الحاجة إلى composite index يشمل != على status
    const snap = await db.collection('bookings')
      .where('salonId', '==', salonId)
      .where('dateTime', '==', dateTime)
      .get();

    const isBooked = snap.docs.some(d => d.data().status !== 'cancelled');

    return res.status(200).json({
      available: !isBooked,
      message: isBooked ? 'هذا الوقت محجوز مسبقاً' : 'الوقت متاح'
    });

  } catch (error) {
    console.error('check-slot error:', error.message);
    return res.status(500).json({ error: 'خطأ في التحقق من الوقت' });
  }
}
