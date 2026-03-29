export default async function handler(req, res) {
  // التحقق من الـ Method
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
          "Authorization": `Key ${process.env.PI_API_KEY}`,   // Key بحرف كبير
        },
      }
    );

    const data = await response.json();

    if (response.ok) {
      // نجاح
      return res.status(200).json({ 
        ...data, 
        success: true,
        message: "Payment approved successfully" 
      });
    } else {
      // خطأ من Pi API
      return res.status(response.status).json({ 
        error: "Pi API Error", 
        status: response.status,
        details: data 
      });
    }
  } catch (error) {
    console.error("Server error approving Pi payment:", error);
    return res.status(500).json({ 
      error: "Server Error", 
      message: "Failed to approve payment" 
    });
  }
}
