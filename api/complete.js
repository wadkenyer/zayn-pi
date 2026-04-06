// api/complete.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const { paymentId, txid } = req.body;

    if (!paymentId || !txid) {
        return res.status(400).json({ success: false, error: 'paymentId و txid مطلوبين' });
    }

    console.log(`[Complete Mock] ✅ تم إكمال الدفع: ${paymentId} | TxID: ${txid}`);

    // نرجع نجاح فوري (Mock)
    return res.status(200).json({ 
        success: true, 
        message: "Payment completed successfully (Mock mode - Pi API endpoint changed)"
    });
}
