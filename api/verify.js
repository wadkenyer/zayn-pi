import { setCors, checkRateLimit } from './_lib.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

  if (!(await checkRateLimit(req))) {
    return res.status(429).json({ success: false, error: 'Too many requests' });
  }

  const { paymentId } = req.body || {};
  if (!paymentId || typeof paymentId !== 'string' || paymentId.length > 100) {
    return res.status(400).json({ success: false, error: 'paymentId مطلوب' });
  }

  const PI_API_KEY = process.env.PI_API_KEY;
  if (!PI_API_KEY) {
    return res.status(500).json({ success: false, error: 'Server misconfiguration' });
  }

  try {
    const response = await fetch(
      `https://api.minepi.com/v2/payments/${encodeURIComponent(paymentId)}`,
      {
        method: 'GET',
        headers: { 'Authorization': `Key ${PI_API_KEY}` },
      }
    );

    const data = await response.json();

    if (response.ok) {
      return res.status(200).json({ success: true, data });
    }
    return res.status(response.status).json({ success: false, error: 'فشل في جلب بيانات الدفع' });

  } catch (error) {
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}
