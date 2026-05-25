// api/firebase-token.js
// يتحقق من Pi access token ويُعيد Firebase custom token

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// تهيئة Firebase Admin مرة واحدة فقط
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { piAccessToken, piUsername } = req.body;

  if (!piAccessToken || !piUsername) {
    return res.status(400).json({ error: 'piAccessToken و piUsername مطلوبان' });
  }

  // التحقق من صحة الـ username (حروف وأرقام وشرطة سفلية فقط)
  if (!/^[a-zA-Z0-9_]{1,50}$/.test(piUsername)) {
    return res.status(400).json({ error: 'username غير صالح' });
  }

  try {
    // تحقق من Pi Access Token عبر Pi API
    const piRes = await fetch('https://api.minepi.com/v2/me', {
      headers: { Authorization: `Bearer ${piAccessToken}` }
    });

    if (!piRes.ok) {
      return res.status(401).json({ error: 'Pi token غير صالح' });
    }

    const piUser = await piRes.json();

    // تأكد أن الـ username يطابق التوكن
    if (piUser.username !== piUsername) {
      return res.status(401).json({ error: 'Username لا يطابق التوكن' });
    }

    // أنشئ Firebase custom token بـ Pi username كـ UID
    const firebaseToken = await getAuth().createCustomToken(piUsername, {
      piUsername,
      piUid: piUser.uid || piUsername
    });

    return res.status(200).json({ success: true, firebaseToken });

  } catch (error) {
    console.error('Firebase token error:', error.message);
    return res.status(500).json({ error: 'خطأ في إنشاء التوكن' });
  }
}
