// api/cancel.js
// المهمة: إلغاء الحجز + معالجة استرداد الـ Pi حسب وقت الإلغاء

export default async function handler(req, res) {

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { bookingId, user, bookingDateTime, amount } = req.body;

  // التحقق من البيانات المطلوبة
  if (!bookingId || !user || !bookingDateTime) {
    return res.status(400).json({ 
      success: false, 
      error: 'bookingId و user و bookingDateTime مطلوبة' 
    });
  }

  try {
    // ===== حساب وقت الإلغاء =====
    const now = new Date();
    const bookingTime = new Date(bookingDateTime);
    const hoursUntilBooking = (bookingTime - now) / (1000 * 60 * 60);

    let refundPolicy;
    let refundAmount;
    let refundPercentage;

    if (hoursUntilBooking >= 24) {
      // إلغاء قبل 24 ساعة أو أكثر → استرداد كامل
      refundPercentage = 100;
      refundAmount = amount;
      refundPolicy = 'full_refund';
    } else if (hoursUntilBooking >= 2) {
      // إلغاء بين 2 و 24 ساعة → استرداد 50%
      refundPercentage = 50;
      refundAmount = amount * 0.5;
      refundPolicy = 'partial_refund';
    } else {
      // إلغاء أقل من ساعتين → لا استرداد
      refundPercentage = 0;
      refundAmount = 0;
      refundPolicy = 'no_refund';
    }

    // ===== تسجيل الإلغاء في Firebase (عبر Admin SDK) =====
    // ملاحظة: التحديث الفعلي في Firebase يتم من التطبيق
    // هذا الـ endpoint يحسب السياسة ويرد بها

    console.log(`🚫 Cancel request: booking=${bookingId} | user=${user} | hours=${hoursUntilBooking.toFixed(1)} | policy=${refundPolicy}`);

    return res.status(200).json({
      success: true,
      bookingId,
      user,
      hoursUntilBooking: hoursUntilBooking.toFixed(1),
      refundPolicy,
      refundPercentage,
      refundAmount: refundAmount.toFixed(2),
      message: getRefundMessage(refundPolicy, refundAmount, refundPercentage)
    });

  } catch (error) {
    console.error('❌ Cancel error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

function getRefundMessage(policy, amount, percentage) {
  switch (policy) {
    case 'full_refund':
      return `✅ سيتم استرداد ${amount} Pi كاملاً خلال 24 ساعة`;
    case 'partial_refund':
      return `⚠️ سيتم استرداد ${percentage}% فقط (${amount} Pi) لأن الإلغاء أقل من 24 ساعة`;
    case 'no_refund':
      return `❌ لا يمكن الاسترداد — الإلغاء أقل من ساعتين من الموعد`;
    default:
      return 'تم معالجة الإلغاء';
  }
}
