// api/_admin.js — مشترك بين جميع الـ API endpoints
import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export function getAdminDb() {
  if (!getApps().length) {
    const { FIREBASE_PROJECT_ID: projectId, FIREBASE_CLIENT_EMAIL: clientEmail, FIREBASE_PRIVATE_KEY: privateKey } = process.env;
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Firebase Admin credentials missing');
    }
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') }) });
  }
  return getFirestore(getApp());
}

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-pi-token');
}

// يتحقق من الـ Pi token في الـ header ويُرجع اسم المستخدم المؤكد من Pi Network
// يُرجع null إذا فشل التحقق أو لم يكن Admin
export async function verifyAdmin(req) {
  const token = req.headers['x-pi-token'];
  if (!token) return null;

  const ADMIN = process.env.ADMIN_USERNAME || 'wadkenyer';

  try {
    const piRes = await fetch('https://api.minepi.com/v2/me', {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000)
    });
    if (!piRes.ok) return null;
    const piUser = await piRes.json();
    if (piUser.username === ADMIN) return piUser.username;
    return null;
  } catch (e) {
    console.warn('verifyAdmin Pi API check failed:', e.message);
    return null;
  }
}

