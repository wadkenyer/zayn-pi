// api/notify.js
// المهمة: إرسال إشعار WhatsApp لصاحب الصالون عند كل حجز جديد
// يعمل على Vercel Serverless Functions

export default async function handler(req, res) {

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const {
    ownerPhone,    // رقم واتساب صاحب الصالون مثال: +218910000000
    salonName,     // اسم الصالون
    customerName,  // اسم الزبون (Pi username)
    serviceName,   // اسم الخدمة
    dateTime,      // وقت الموعد
    depositAmount, // مبلغ العربون
    bookingId,     // ID الحجز
    type           // "new_booking" | "cancelled" | "reminder"
  } = req.body;

  if (!ownerPhone || !customerName) {
    return res.status(400).json({ error: 'ownerPhone و customerName مطلوبان' });
  }

  // ===== بناء الرسالة حسب النوع =====
  let message = '';

  switch (type) {
    case 'new_booking':
      message = `🔔 *حجز جديد في ${salonName}*\n\n` +
        `👤 الزبون: @${customerName}\n` +
        `✂️ الخدمة: ${serviceName}\n` +
        `📅 الموعد: ${dateTime}\n` +
        `💰 العربون المدفوع: ${depositAmount} Pi\n\n` +
        `⚡ يرجى قبول أو رفض الحجز من تطبيق ZAYN PI\n` +
        `🔗 zaynpiddbdfaeb4520.pinet.com`;
      break;

    case 'cancelled':
      message = `❌ *تم إلغاء حجز في ${salonName}*\n\n` +
        `👤 الزبون: @${customerName}\n` +
        `✂️ الخدمة: ${serviceName}\n` +
        `📅 كان الموعد: ${dateTime}`;
      break;

    case 'reminder':
      message = `⏰ *تذكير: موعد قادم في ${salonName}*\n\n` +
        `👤 الزبون: @${customerName}\n` +
        `✂️ الخدمة: ${serviceName}\n` +
        `📅 الموعد: ${dateTime}\n\n` +
        `يصل الزبون خلال ساعة تقريباً`;
      break;

    case 'accepted':
      message = `✅ *تم قبول حجزك في ${salonName}*\n\n` +
        `✂️ الخدمة: ${serviceName}\n` +
        `📅 موعدك: ${dateTime}\n\n` +
        `نراك قريباً! 🎉`;
      break;

    default:
      message = `📩 رسالة من ZAYN PI بخصوص حجز #${bookingId}`;
  }

  // ===== إرسال عبر Twilio WhatsApp =====
  const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_WHATSAPP = process.env.TWILIO_WHATSAPP_NUMBER; // مثال: whatsapp:+14155238886

  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_WHATSAPP) {
    // إذا لم يكن Twilio مُعداً — سجّل فقط
    console.log(`📱 [NOTIFY] To: ${ownerPhone} | Type: ${type} | Message: ${message}`);
    return res.status(200).json({
      success: true,
      method: 'logged_only',
      message: 'Twilio not configured — message logged'
    });
  }

  try {
    // تنسيق رقم الهاتف
    const toNumber = `whatsapp:${ownerPhone.startsWith('+') ? ownerPhone : '+' + ownerPhone}`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;

    const body = new URLSearchParams({
      From: TWILIO_WHATSAPP,
      To: toNumber,
      Body: message
    });

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString()
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Twilio error:', data);
      return res.status(400).json({ error: 'فشل إرسال WhatsApp', details: data });
    }

    console.log(`✅ WhatsApp sent to ${ownerPhone} | SID: ${data.sid}`);
    return res.status(200).json({
      success: true,
      method: 'whatsapp',
      sid: data.sid
    });

  } catch (error) {
    console.error('Notify error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
