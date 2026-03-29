// api/pi/approve.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const { paymentId } = req.body;

    if (!paymentId) {
        return res.status(400).json({ success: false, error: 'paymentId مطلوب' });
    }

    try {
        console.log(`[Approve] Processing payment: ${paymentId}`);

        const response = await fetch(`https://api.testnet.minepi.com/v2/payments/${paymentId}/approve`, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${process.env.PI_SERVER_API_KEY}`,
                'Content-Type': 'application/json',
            }
        });

        const data = await response.json();

        if (response.ok) {
            console.log(`[Approve] Payment ${paymentId} approved successfully`);
            return res.status(200).json({ success: true, data });
        } else {
            console.error(`[Approve] Failed:`, data);
            return res.status(response.status).json({ 
                success: false, 
                error: data.error || 'فشل في الموافقة على الدفع' 
            });
        }
    } catch (error) {
        console.error(`[Approve] Server error:`, error);
        return res.status(500).json({ 
            success: false, 
            error: 'حدث خطأ داخلي أثناء الموافقة على الدفع' 
        });
    }
}
