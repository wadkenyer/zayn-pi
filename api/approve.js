// api/approve.js
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
        console.error("❌ PI_SERVER_API_KEY غير موجود");
        return res.status(500).json({ success: false, error: 'خطأ في إعدادات السيرفر' });
    }

    try {
        console.log(`[Approve] محاولة الموافقة على الدفع: ${paymentId}`);

        // الـ URL المحدث (جرب هذا أولاً)
        const url = `https://api.testnet.minepi.com/v2/payments/${paymentId}/approve`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${apiKey}`,
                'Content-Type': 'application/json',
            }
        });

        const data = await response.json().catch(() => ({}));

        console.log(`[Approve] Status: ${response.status} | Response:`, data);

        if (response.ok) {
            console.log(`[Approve] ✅ تمت الموافقة بنجاح`);
            return res.status(200).json({ success: true, data });
        } else if (response.status === 404) {
            return res.status(404).json({ 
                success: false, 
                error: 'الـ API endpoint غير موجود (Pi غير الـ URLs). جاري التحديث...' 
            });
        } else {
            return res.status(response.status).json({ 
                success: false, 
                error: data.error || data.message || 'فشل في الموافقة' 
            });
        }
    } catch (error) {
        console.error(`[Approve] خطأ:`, error);
        return res.status(500).json({ success: false, error: 'خطأ داخلي في السيرفر' });
    }
}
