// api/get-ledger.js — جلب سجلات الـ Ledger (مستحقات + استردادات)
import { getAdminDb, cors, verifyAdmin } from './_admin.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { callerUsername, filterType, filterStatus } = req.body;

  try {
    const db = getAdminDb();

    // التحقق من Admin عبر Pi Network — مستقل تماماً عن أي قيمة في الـ body
    const adminUsername = await verifyAdmin(req);

    if (adminUsername) {
      // Admin يرى كل شيء مع فلاتر اختيارية
      let q = db.collection('ledger');
      if (filterStatus) q = q.where('status', '==', filterStatus);
      if (filterType)   q = q.where('type', '==', filterType);

      const snap = await q.get();
      const entries = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

      return res.status(200).json({ success: true, entries, isAdmin: true });
    }

    // غير Admin — يحتاج callerUsername لفلترة بياناته الخاصة فقط
    if (!callerUsername) return res.status(400).json({ error: 'callerUsername مطلوب' });

    const [payoutSnap, refundSnap] = await Promise.all([
      db.collection('ledger')
        .where('type', '==', 'payout_to_salon')
        .where('recipientUsername', '==', callerUsername)
        .get(),
      db.collection('ledger')
        .where('type', '==', 'refund_to_customer')
        .where('recipientUsername', '==', callerUsername)
        .get()
    ]);

    const entries = [...payoutSnap.docs, ...refundSnap.docs]
      .map(d => ({ id: d.id, ...d.data(), dueBy: d.data().dueBy || null }))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

    return res.status(200).json({ success: true, entries, isAdmin: false });

  } catch (error) {
    console.error('get-ledger error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
