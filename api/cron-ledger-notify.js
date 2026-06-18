// api/cron-ledger-notify.js — تشغيل يومي: إشعار Admin بسطور Ledger المتأخرة
import { getAdminDb } from './_admin.js';

const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req, res) {
  // Vercel يُرسل هذا الـ header تلقائياً عند تشغيل الـ Cron
  if (req.headers['authorization'] !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.method !== 'GET') return res.status(405).end();

  const ADMIN_PHONE   = process.env.ADMIN_PHONE;
  const TWILIO_SID    = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_TOKEN  = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_WA     = process.env.TWILIO_WHATSAPP_NUMBER;

  try {
    const db  = getAdminDb();
    const now = new Date();

    // جلب السطور المتأخرة فقط (pending و dueBy قبل الآن)
    const snap = await db.collection('ledger')
      .where('status', '==', 'pending')
      .get();

    const overdue = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(e => e.dueBy && new Date(e.dueBy) < now);

    if (!overdue.length) {
      console.log('[cron-ledger] لا توجد سطور متأخرة');
      return res.status(200).json({ checked: snap.size, overdue: 0 });
    }

    const payouts = overdue.filter(e => e.type === 'payout_to_salon');
    const refunds = overdue.filter(e => e.type === 'refund_to_customer');

    const totalPayout = payouts.reduce((s, e) => s + (e.amountOwed || 0), 0).toFixed(2);
    const totalRefund = refunds.reduce((s, e) => s + (e.amountOwed || 0), 0).toFixed(2);

    const message =
      `⚠️ *ZAYN PI — Ledger متأخر*\n\n` +
      `لديك *${overdue.length} سطر* يتجاوز موعد الدفع:\n\n` +
      (payouts.length ? `💰 مستحقات صالونات: ${payouts.length} سطر — إجمالي ${totalPayout} Pi\n` : '') +
      (refunds.length ? `↩️ استردادات زبائن: ${refunds.length} سطر — إجمالي ${totalRefund} Pi\n` : '') +
      `\n🔗 افتح لوحة Admin لتأكيد التحويلات`;

    console.log(`[cron-ledger] ${overdue.length} سطر متأخر`);

    // إرسال WhatsApp إن كان Twilio مُعداً
    if (ADMIN_PHONE && TWILIO_SID && TWILIO_TOKEN && TWILIO_WA) {
      const toNumber = `whatsapp:${ADMIN_PHONE.startsWith('+') ? ADMIN_PHONE : '+' + ADMIN_PHONE}`;
      const body = new URLSearchParams({ From: TWILIO_WA, To: toNumber, Body: message });

      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: body.toString()
        }
      );
      const twilioData = await twilioRes.json();
      if (!twilioRes.ok) console.error('[cron-ledger] Twilio error:', twilioData);
      else console.log('[cron-ledger] WhatsApp أُرسل — SID:', twilioData.sid);
    } else {
      console.log('[cron-ledger] Twilio/ADMIN_PHONE غير مُعدّ — الرسالة:\n', message);
    }

    return res.status(200).json({ checked: snap.size, overdue: overdue.length, payouts: payouts.length, refunds: refunds.length });

  } catch (error) {
    console.error('[cron-ledger] خطأ:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
