export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { paymentId } = req.body;

  if (!paymentId) {
    return res.status(400).json({ error: "paymentId is required" });
  }

  try {
    const response = await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}/approve`,   // ← هذا هو الصحيح
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Key ${process.env.PI_API_KEY}`,   // Key بحرف كبير
        },
      }
    );

    const data = await response.json();

    if (response.ok) {
      return res.status(200).json({
        ...data,
        success: true,
        message: "Payment approved successfully (Testnet)"
      });
    } else {
      console.error("Pi Approve Error:", response.status, data);
      return res.status(response.status || 400).json({
        error: "Pi API Error",
        status: response.status,
        details: data
      });
    }
  } catch (error) {
    console.error("Server error approving Pi payment:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to connect to Pi API"
    });
  }
}
