
// api/approve.js
export default async function handler(req, res) {
  // السماح فقط بطلبات POST من التطبيق الخاص بك
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { paymentId } = req.body;

  try {
    // الاتصال بـ API شبكة الاختبار (Testnet) للموافقة على الدفع
    const response = await fetch(
      `https://api.testnet.minepi.com/v2/payments/${paymentId}/approve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // التأكد من إضافة PI_API_KEY في إعدادات Vercel
          "Authorization": `Key ${process.env.PI_API_KEY}` 
        }
      }
    );

    const data = await response.json();

    if (response.ok) {
      // إرجاع رد نجاح للسيرفر لكي تظهر شاشة المحفظة للمستخدم
      res.status(200).json({ ...data, success: true });
    } else {
      // إرجاع تفاصيل الخطأ في حال رفضت الشبكة العملية
      res.status(400).json({ error: "Pi API Error", details: data });
    }

  } catch (error) {
    // معالجة أخطاء الاتصال أو الخادم الداخلية
    res.status(500).json({ error: "Internal Server Error" });
  }
}
