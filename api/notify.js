import { setCors, checkRateLimit, sanitize, isValidPhone } from './_lib.js';

const ALLOWED_TYPES = ['new_booking', 'cancelled', 'reminder', 'accepted'];

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!checkRateLimit(req)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const {
    ownerPhone, salonName, customerName, serviceName,
    dateTime, depositAmount, bookingId, type
  } = req.body || {};

  if (!ownerPhone || !customerName) {
    return res.status(400).json({ error: 'ownerPhone و customerName مطلوبان' });
  }

  if (!isValidPhone(ownerPhone)) {
    return res.status(400).json({ error: 'رقم الهاتف غير صالح' });
  }

  if (type && !ALLOWED_TYPES.includes(type)) {
    return res.status(400).json({ error: 'نوع الإشعار غير مسموح' });
  }

  // Sanitize all user-controlled fields
  const safe = {
    salonName:     sanitize(salonName, 100),
    customerName:  sanitize(customerName, 80),
    serviceName:   sanitize(serviceName, 100),
    dateTime:      sanitize(dateTime, 50),
    depositAmount: parseFloat(depositAmount) || 0,
    bookingId:     sanitize(bookingId, 100),
    phone:         ownerPhone.trim().replace(/[^\d+]/g, ''),
  };

  let message = '';
  switch (type) {
    case 'new_booking':
      message =
        `🔔 *حجز جديد في ${safe.salonName}*\n\n` +
        `👤 الزبون: @${safe.customerName}\n` +
        `✂️ الخدمة: ${safe.serviceName}\n` +
        `📅 الموعد: ${safe.dateTime}\n` +
        `💰 العربون المدفوع: ${safe.depositAmount} Pi\n\n` +
        `⚡ يرجى قبول أو رفض الحجز من تطبيق ZAYN PI`;
      break;
    case 'cancelled':
      message =
        `❌ *تم إلغاء حجز في ${safe.salonName}*\n\n` +
        `👤 الزبون: @${safe.customerName}\n` +
        `✂️ الخدمة: ${safe.serviceName}\n` +
        `📅 كان الموعد: ${safe.dateTime}`;
      break;
    case 'reminder':
      message =
        `⏰ *تذكير: موعد قادم في ${safe.salonName}*\n\n` +
        `👤 الزبون: @${safe.customerName}\n` +
        `✂️ الخدمة: ${safe.serviceName}\n` +
        `📅 الموعد: ${safe.dateTime}\n\n` +
        `يصل الزبون خلال ساعة تقريباً`;
      break;
    case 'accepted':
      message =
        `✅ *تم قبول حجزك في ${safe.salonName}*\n\n` +
        `✂️ الخدمة: ${safe.serviceName}\n` +
        `📅 موعدك: ${safe.dateTime}\n\n` +
        `نراك قريباً! 🎉`;
      break;
    default:
      message = `📩 رسالة من ZAYN PI بخصوص حجز #${safe.bookingId}`;
  }

  const TWILIO_SID    = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_TOKEN  = process.env.TWILIO_AUTH_TOKEN;
  const TWILIO_WA     = process.env.TWILIO_WHATSAPP_NUMBER;

  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_WA) {
    return res.status(200).json({ success: true, method: 'logged_only' });
  }

  try {
    const toNumber = `whatsapp:${safe.phone.startsWith('+') ? safe.phone : '+' + safe.phone}`;
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;

    const body = new URLSearchParams({ From: TWILIO_WA, To: toNumber, Body: message });

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
      return res.status(400).json({ error: 'فشل إرسال WhatsApp' });
    }

    return res.status(200).json({ success: true, method: 'whatsapp', sid: data.sid });

  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
}
