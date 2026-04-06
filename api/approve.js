export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const { paymentId } = req.body;
    if (!paymentId) {
        return res.status(400).json({ success: false, error: 'paymentId مطلوب' });
    }

    const apiKey = process.env.PI_SERVER_API_KEY;
    if (!apiKey) {
        console.error("❌ PI_SERVER_API_KEY غير مضبوط في Vercel");
        return res.status(500).json({ success: false, error: 'خطأ في إعدادات السيرفر' });
    }

    try {
        console.log(`[Approve] جاري معالجة الدفع: ${paymentId}`);

        const response = await fetch(`https://api.testnet.minepi.com/v2/payments/${paymentId}/approve`, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${apiKey}`,
                'Content-Type': 'application/json',
            }
        });

        const data = await response.json();

        if (response.ok) {
            console.log(`[Approve] ✅ تمت الموافقة على ${paymentId}`);
            return res.status(200).json({ success: true, data });
        } else {
            console.error(`[Approve] ❌ فشل:`, data);
            return res.status(response.status).json({ 
                success: false, 
                error: data.error || data.message || 'فشل في الموافقة' 
            });
        }
    } catch (error) {
        console.error(`[Approve] Server Error:`, error);
        return res.status(500).json({ success: false, error: 'خطأ داخلي في السيرفر' });
    }
}
