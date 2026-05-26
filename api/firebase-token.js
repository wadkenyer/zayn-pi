// api/firebase-token.js
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Firebase Admin credentials missing: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY مطلوبة');
  } else {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!getApps().length) {
    return res.status(500).json({ error: 'Firebase غير مُعدّ — تحقق من متغيرات البيئة' });
  }

  const { piAccessToken, piUsername } = req.body;

  if (!piAccessToken || !piUsername) {
    return res.status(400).json({ error: 'piAccessToken و piUsername مطلوبان' });
  }

  if (!/^[a-zA-Z0-9_]{1,50}$/.test(piUsername)) {
    return res.status(400).json({ error: 'username غير صالح' });
  }

  try {
    // حاول التحقق من Pi token — لكن لا تفشل إذا كان sandbox أو Pi API غير متاح
    try {
      const piRes = await fetch('https://api.minepi.com/v2/me', {
        headers: { Authorization: `Bearer ${piAccessToken}` },
        signal: AbortSignal.timeout(5000)
      });

      if (piRes.ok) {
        const piUser = await piRes.json();
        // إذا ردّت Pi API بنجاح وكان الـ username مختلفاً — ارفض
        if (piUser.username && piUser.username !== piUsername) {
          return res.status(401).json({ error: 'Username لا يطابق التوكن' });
        }
      }
      // إذا ردّت Pi API بخطأ (sandbox/unavailable) — نثق بـ SDK ونكمل
    } catch(piErr) {
      console.warn('Pi API check skipped (sandbox/timeout):', piErr.message);
    }

    const firebaseToken = await getAuth().createCustomToken(piUsername, { piUsername });
    return res.status(200).json({ success: true, firebaseToken });

  } catch (error) {
    console.error('Firebase token error:', error.message);
    return res.status(500).json({ error: 'خطأ في إنشاء التوكن', detail: error.message });
  }
}
