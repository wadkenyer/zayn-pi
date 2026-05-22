// api/verify.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const { paymentId } = req.body;

    if (!paymentId) {
        return res.status(400).json({ success: false, error: 'paymentId مطلوب' });
    }

  const PI_API_KEY = process.env.PI_API_KEY;
  if (!PI_API_KEY) {
    return res.status(500).json({ success: false, error: 'Server misconfiguration' });
  }

    try {
        console.log(`[Verify] Verifying payment: ${paymentId}`);

        const response = await fetch(`https://api.minepi.com/v2/payments/${paymentId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Key ${PI_API_KEY}`,
            }
        });

        const data = await response.json();

        if (response.ok) {
            return res.status(200).json({ success: true, data });
        } else {
            return res.status(response.status).json({ 
                success: false, 
                error: 'فشل في جلب بيانات الدفع' 
            });
        }
    } catch (error) {
        console.error(`[Verify] Server error:`, error);
        return res.status(500).json({ 
            success: false, 
            error: 'حدث خطأ أثناء التحقق من الدفع' 
        });
    }
}
