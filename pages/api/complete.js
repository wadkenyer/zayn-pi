export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { paymentId, txid } = req.body;

  if (!paymentId || !txid) {
    return res.status(400).json({ error: "paymentId and txid are required" });
  }

  try {
    const response = await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}/complete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Key ${process.env.PI_API_KEY}`,
        },
        body: JSON.stringify({ txid })
      }
    );

    const data = await response.json();

    if (response.ok) {
      return res.status(200).json({ success: true, data });
    } else {
      console.error("Pi Complete failed:", data);
      return res.status(response.status).json({ error: "Pi Complete Error", details: data });
    }
  } catch (error) {
    console.error("Complete server error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
}
