// pages/api/approve.js
export default async function handler(req, res) {
  // التحقق من الـ Method
  if (req.method !== "POST") {
    return res.status(405).json({ 
      error: "Method not allowed",
      message: "يجب استخدام POST فقط"
    });
  }

  const { paymentId } = req.body;

  // التحقق من وجود paymentId
  if (!paymentId) {
    return res.status(400).json({ 
      error: "paymentId is required",
      message: "معرف الدفع مطلوب"
    });
  }

  // التحقق من وجود API Key
  if (!process.env.PI_API_KEY) {
    console.error("PI_API_KEY is not set in environment variables");
    return res.status(500).json({ 
      error: "Server configuration error",
      message: "مفتاح API غير مضبوط"
    });
  }

  try {
    const response = await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}/approve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Key ${process.env.PI_API_KEY}`,   // حرف K كبير مهم جدًا
        },
      }
    );

    const data = await response.json();

    if (response.ok) {
      console.log(`Payment ${paymentId} approved successfully`);
      return res.status(200).json({ 
        ...data, 
        success: true,
        message: "تمت الموافقة على الدفع بنجاح"
      });
    } else {
      console.error("Pi Approve failed:", response.status, data);
      return res.status(response.status || 400).json({
        error: "Pi API Error",
        status: response.status,
        details: data,
        message: data.error || "فشل في الموافقة على الدفع"
      });
    }
  } catch (error) {
    console.error("Approve server error:", error);
    return res.status(500).json({ 
      error: "Internal Server Error",
      message: "حدث خطأ في الاتصال بـ Pi API"
    });
  }
}
