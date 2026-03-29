// api/pi/cancel.js
export default async function handler(req, res) {
    // السماح فقط بـ POST
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false, 
            error: 'Method Not Allowed. Use POST.' 
        });
    }

    const { paymentId } = req.body;

    // التحقق من وجود paymentId
    if (!paymentId) {
        return res.status(400).json({ 
            success: false, 
            error: 'paymentId مطلوب' 
        });
    }

    try {
        console.log(`[Cancel] Attempting to cancel payment: ${paymentId}`);

        const response = await fetch(`https://api.testnet.minepi.com/v2/payments/${paymentId}/cancel`, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${process.env.PI_SERVER_API_KEY}`,
                'Content-Type': 'application/json',
            }
        });

        const data = await response.json();

        if (response.ok) {
            console.log(`[Cancel] Payment ${paymentId} cancelled successfully`);
            return res.status(200).json({
                success: true,
                message: 'تم إلغاء الدفع بنجاح',
                data: data
            });
        } else {
            console.error(`[Cancel] Failed to cancel payment ${paymentId}:`, data);
            return res.status(response.status).json({
                success: false,
                error: data.error || 'فشل في إلغاء الدفع',
                details: data
            });
        }

    } catch (error) {
        console.error(`[Cancel] Server error for payment ${paymentId}:`, error);
        return res.status(500).json({
            success: false,
            error: 'حدث خطأ داخلي أثناء إلغاء الدفع',
            message: error.message
        });
    }
}