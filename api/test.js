// api/test.js — تشخيص مؤقت
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const result = { step: 'start', env: {}, error: null };

  // 1. تحقق من المتغيرات
  result.env = {
    PROJECT_ID:   !!process.env.FIREBASE_PROJECT_ID,
    CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
    PRIVATE_KEY:  !!process.env.FIREBASE_PRIVATE_KEY,
    KEY_PREVIEW:  (process.env.FIREBASE_PRIVATE_KEY || '').substring(0, 40)
  };
  result.step = 'env_checked';

  // 2. جرّب import Firebase Admin مباشرة
  try {
    const { initializeApp, cert, getApps, getApp } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    result.step = 'imported';

    if (!getApps().length) {
      const projectId   = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    }
    result.step = 'initialized';

    const db = getFirestore(getApp());
    const snap = await db.collection('bookings').limit(1).get();
    result.step = 'queried';
    result.bookingsCount = snap.size;
    result.success = true;

  } catch(e) {
    result.error = e.message;
    result.stack = e.stack?.split('\n').slice(0,3).join(' | ');
  }

  res.status(200).end(JSON.stringify(result, null, 2));
}
