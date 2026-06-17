// api/confirm-ledger.js — تأكيد تحويل Pi (Admin فقط)
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, cors } from './_admin.js';

const ADMIN = process.env.ADMIN_USERNAME || 'wadkenyer';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { ledgerId, confirmTxid, callerUsername } = req.body;

  if (!ledgerId || !confirmTxid || !callerUsername) {
    return res.status(400).json({ error: 'ledgerId و confirmTxid و callerUsername مطلوبة' });
  }

  if (callerUsername !== ADMIN) {
    return res.status(403).json({ error: 'غير مصرح — Admin فقط' });
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

    return res.status(200).json({ success: true, ledgerId });

  } catch (error) {
    console.error('confirm-ledger error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
