// api/approve.js
export default async function handler(req, res) {
    const { paymentId } = req.body;

    try {
        const response = await fetch(
            `https://api.testnet.minepi.com/v2/payments/${paymentId}/approve`, // الرابط الذي أرسلته أنت
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Key ${process.env.PI_API_KEY}` // تأكد أن هذا المفتاح مضاف في Vercel
                }
            }
        );

        const data = await response.json();

        if (response.ok) {
            res.status(200).json({ ...data, success: true });
        } else {
            res.status(400).json({ error: "خطأ من شبكة باي", details: data });
        }
    } catch (error) {
        res.status(500).json({ error: "خطأ داخلي في السيرفر" });
    }
}    res.status(500).json({ error: "Internal Server Error" });
  }
}
