// api/approve.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const { paymentId } = req.body;

    if (!paymentId) {
        return res.status(400).json({ success: false, error: 'paymentId مطلوب' });
    }

    console.log(`[Approve Mock] ✅ تمت الموافقة على الدفع: ${paymentId}`);

    // نرجع نجاح فوري (Mock)
    return res.status(200).json({ 
        success: true, 
        message: "Payment approved successfully (Mock mode - Pi API endpoint changed)"
    });
}
