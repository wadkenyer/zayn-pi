export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const { paymentId, txid } = req.body;
    if (!paymentId || !txid) {
        return res.status(400).json({ success: false, error: 'paymentId و txid مطلوبين' });
    }

    const apiKey = process.env.PI_SERVER_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ success: false, error: 'خطأ في إعدادات السيرفر' });
    }

    try {
        console.log(`[Complete] paymentId: ${paymentId} | txid: ${txid}`);

        const response = await fetch(`https://api.testnet.minepi.com/v2/payments/${paymentId}/complete`, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ txid })
        });

        const data = await response.json();

        if (response.ok) {
            console.log(`[Complete] ✅ تم إكمال الدفع بنجاح`);
            return res.status(200).json({ success: true, data });
        } else {
            console.error(`[Complete] ❌ فشل:`, data);
            return res.status(response.status).json({ 
                success: false, 
                error: data.error || 'فشل في إكمال الدفع' 
            });
        }
    } catch (error) {
        console.error(`[Complete] Server Error:`, error);
        return res.status(500).json({ success: false, error: 'خطأ داخلي' });
    }
}
