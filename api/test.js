// api/test.js — تشخيص مؤقت، احذفه بعد الإصلاح
import { getAdminDb, cors } from './_admin.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const results = { env: {}, firebase: null, query: null };

  // 1. تحقق من وجود متغيرات البيئة
  results.env = {
    PROJECT_ID:    !!process.env.FIREBASE_PROJECT_ID,
    CLIENT_EMAIL:  !!process.env.FIREBASE_CLIENT_EMAIL,
    PRIVATE_KEY:   !!process.env.FIREBASE_PRIVATE_KEY,
    KEY_STARTS:    process.env.FIREBASE_PRIVATE_KEY?.substring(0, 30) || 'MISSING'
  };

  // 2. جرّب الاتصال بـ Firebase
  try {
    const db = getAdminDb();
    results.firebase = 'connected';

    // 3. جرّب قراءة بسيطة
    const snap = await db.collection('bookings').limit(1).get();
    results.query = `OK — found ${snap.size} doc(s)`;
  } catch (e) {
    results.firebase = 'ERROR: ' + e.message;
  }

  return res.status(200).json(results);
}
