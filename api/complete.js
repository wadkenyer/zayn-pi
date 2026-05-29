import { setCors, checkRateLimit, verifyPiToken } from './_lib.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

  if (!(await checkRateLimit(req))) {
    return res.status(429).json({ success: false, error: 'Too many requests' });
  }

  // VULN-01/04 fix: verify Pi token before completing any payment
  const verifiedUser = await verifyPiToken(req);
  if (!verifiedUser) {
    return res.status(401).json({ success: false, error: 'غير مصرح' });
  }

  const { paymentId, txid } = req.body || {};
  if (!paymentId || typeof paymentId !== 'string' || paymentId.length > 100) {
    return res.status(400).json({ success: false, error: 'paymentId مطلوب' });
  }
  if (!txid || typeof txid !== 'string' || txid.length > 200) {
    return res.status(400).json({ success: false, error: 'txid مطلوب' });
  }

  const PI_API_KEY = process.env.PI_API_KEY;
  if (!PI_API_KEY) {
    return res.status(500).json({ success: false, error: 'Server misconfiguration' });
  }

  try {
    const response = await fetch(
      `https://api.minepi.com/v2/payments/${encodeURIComponent(paymentId)}/complete`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Key ${PI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ txid }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: 'Pi API rejection' });
    }

    return res.status(200).json({ success: true, paymentId, txid, data });

  } catch (error) {
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}
