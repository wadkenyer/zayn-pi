// api/pi/cancel.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const { paymentId } = req.body;

    if (!paymentId) {
        return res.status(400).json({ success: false, error: 'paymentId مطلوب' });
    }

    try {
        console.log(`[Cancel] Cancelling payment: ${paymentId}`);

        const response = await fetch(`https://api.testnet.minepi.com/v2/payments/${paymentId}/cancel`, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${process.env.PI_SERVER_API_KEY}`,
            }
        });

        const data = await response.json();

        if (response.ok) {
            console.log(`[Cancel] Payment ${paymentId} cancelled successfully`);
            return res.status(200).json({ success: true, message: 'تم إلغاء الدفع بنجاح', data });
        } else {
            return res.status(response.status).json({ 
                success: false, 
                error: data.error || 'فشل في إلغاء الدفع' 
            });
        }
    } catch (error) {
        console.error(`[Cancel] Server error:`, error);
        return res.status(500).json({ 
            success: false, 
            error: 'حدث خطأ داخلي أثناء إلغاء الدفع' 
        });
    }
}
