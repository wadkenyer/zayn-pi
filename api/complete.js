// api/complete.js
export default async function handler(req, res) {

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { paymentId, txid } = req.body;
  if (!paymentId || !txid) {
    return res.status(400).json({ success: false, error: 'paymentId و txid مطلوبان' });
  }

  const PI_API_KEY = process.env.PI_API_KEY;
  if (!PI_API_KEY) {
    console.error('❌ PI_API_KEY غير موجود في Environment Variables');
    return res.status(500).json({ success: false, error: 'Server misconfiguration' });
  }

  try {
    const response = await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}/complete`,
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
      console.error(`❌ Pi complete failed [${response.status}]:`, data);
      return res.status(response.status).json({
        success: false,
        error: 'Pi API rejection',
        details: data
      });
    }

    console.log(`✅ Payment completed: ${paymentId} | TX: ${txid}`);
    return res.status(200).json({ success: true, paymentId, txid, data });

  } catch (error) {
    console.error('❌ Server error in complete:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
