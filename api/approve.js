// pages/api/approve.js   أو app/api/approve/route.js حسب إصدار Next.js
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
      `https://api.minepi.com/v2/payments/${paymentId}/approve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Key ${process.env.PI_API_KEY}`,   // K كبير
        },
      }
    );

    const data = await response.json();

    if (response.ok) {
      return res.status(200).json({ ...data, success: true });
    } else {
      console.error("Pi Approve failed:", data);
      return res.status(response.status).json({ error: "Pi API Error", details: data });
    }
  } catch (error) {
    console.error("Approve server error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
}
