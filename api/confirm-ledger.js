// api/confirm-ledger.js — تأكيد تحويل Pi (Admin فقط)
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, cors, verifyAdmin } from './_admin.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // التحقق من هوية Admin عبر Pi Network مباشرة (لا نثق بأي قيمة من الـ body)
  const adminUsername = await verifyAdmin(req);
  if (!adminUsername) {
    return res.status(403).json({ error: 'غير مصرح — Admin فقط' });
  }

  const { ledgerId, confirmTxid } = req.body;

  if (!ledgerId || !confirmTxid) {
    return res.status(400).json({ error: 'ledgerId و confirmTxid مطلوبان' });
  }

  if (!/^[a-fA-F0-9]{8,}/.test(confirmTxid)) {
    return res.status(400).json({ error: 'txid غير صالح' });
  }

  try {
    const db = getAdminDb();
    const ref = db.collection('ledger').doc(ledgerId);
    const snap = await ref.get();

    if (!snap.exists) return res.status(404).json({ error: 'السجل غير موجود' });
    if (snap.data().status === 'completed') {
      return res.status(400).json({ error: 'تم تأكيد هذا التحويل مسبقاً' });
    }

    await ref.update({
      status: 'completed',
      confirmTxid,
      completedAt: FieldValue.serverTimestamp()
    });

    // إذا كان استرداداً، حدّث مستند الحجز بنتيجة الاسترداد
    const entry = snap.data();
    if (entry.type === 'refund_to_customer' && entry.bookingId) {
      await db.collection('bookings').doc(entry.bookingId).update({
        refundStatus: 'completed',
        refundTxid: confirmTxid
      });
    }

    return res.status(200).json({ success: true, ledgerId });

  } catch (error) {
    console.error('confirm-ledger error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
