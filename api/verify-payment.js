// api/approve.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { paymentId } = req.body;

  try {
    const response = await fetch(
      `https://api.testnet.minepi.com/v2/payments/${paymentId}/approve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Key ${process.env.PI_API_KEY}` // سيتم جلب المفتاح من إعدادات Vercel
        }
      }
    );

    const data = await response.json();
    if (response.ok) {
      res.status(200).json(data);
    } else {
      res.status(400).json({ error: "Pi API Error", details: data });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
}
